import os, random, string, hashlib, hmac, base64, json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
from pathlib import Path
import redis
import httpx
import bcrypt
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, ReplyTo
from dotenv import load_dotenv
from jinja2 import Environment, FileSystemLoader, select_autoescape, TemplateNotFound
# --- ADD THESE to your existing imports ---
import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

load_dotenv()

# Config 
REDIS_URL        = os.getenv("REDIS_URL",        "redis://localhost:6379")
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
FROM_EMAIL       = os.getenv("FROM_EMAIL",       "noreply@evaerahealth.in")
FROM_NAME        = os.getenv("FROM_NAME",        "EvaEraHealth")
CLINIC_EMAIL     = os.getenv("CLINIC_EMAIL",     "vrinda20032001@gmail.com")
SUPABASE_URL      = os.getenv("SUPABASE_URL",      "")
SUPABASE_KEY      = os.getenv("SUPABASE_KEY",      "")  # server-side only
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")


def clinic_email_address() -> str:
    return os.getenv("CLINIC_EMAIL", CLINIC_EMAIL)


def _is_video_mode(mode: str | None) -> bool:
    if not mode:
        return False
    m = mode.lower().strip()
    return m in ("video", "online") or "video" in m


def _email_contact_context() -> dict:
    return {
        "clinic_email": clinic_email_address(),
        "clinic_phone": "+91 80690 50000",
    }

ADMIN_OTP_RATE_LIMIT    = 3    # max 3 OTP requests per 15 min
ADMIN_OTP_RATE_WINDOW   = 900  # 15 min in seconds
ADMIN_OTP_TTL           = 300  # 5 min OTP expiry
ADMIN_RESEND_COOLDOWN   = 30   # 30 sec between resends

PATIENT_OTP_RATE_LIMIT  = 5    # max 5 OTP sends per 15 min per email
PATIENT_OTP_RATE_WINDOW = 900
PATIENT_OTP_TTL         = 300  # 5 min OTP expiry
PATIENT_RESEND_COOLDOWN = 30   # 30 sec between resends
PATIENT_VERIFY_MAX_FAILS = 5   # lock after 5 wrong OTP attempts
PATIENT_VERIFY_LOCKOUT  = 900  # 15 min lockout

_DEFAULT_CORS_ORIGINS = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:3000",
    "http://localhost:3000",
]

def _parse_cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "").strip()
    if raw:
        return [origin.strip() for origin in raw.split(",") if origin.strip()]
    return list(_DEFAULT_CORS_ORIGINS)

CORS_ORIGINS = _parse_cors_origins()

# Redis 
r = redis.from_url(REDIS_URL, decode_responses=True)

# App 
app = FastAPI(title="EvaEraHealth API", version="7.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

print(f"[CORS] Allowed origins: {', '.join(CORS_ORIGINS)}")

EMAIL_TEMPLATE_DIR = Path(__file__).resolve().parent / "templates" / "emails"
email_templates = Environment(
    loader=FileSystemLoader(str(EMAIL_TEMPLATE_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)

def render_email_template(template_name: str, **context) -> str:
    try:
        tpl = email_templates.get_template(template_name)
    except TemplateNotFound as exc:
        raise RuntimeError(f"Missing email template: {template_name}") from exc
    return tpl.render(**context)


def _ensure_email_templates_present() -> None:
    required_templates = (
        "otp_patient.html",
        "otp_admin.html",
        "report.html",
        "appointment_confirmation.html",
        "appointment_update.html",
        "appointment_completed.html",
        "clinic_contact.html",
        "partials/footer.html",
        "partials/email_header.html",
        "partials/email_contact_block.html",
        "partials/in_person_section.html",
        "partials/meet_section.html",
        "partials/video_section.html",
    )
    missing = [name for name in required_templates if not (EMAIL_TEMPLATE_DIR / name).is_file()]
    if missing:
        raise RuntimeError(f"Missing required email templates: {', '.join(missing)}")


_ensure_email_templates_present()


# Schemas

class SendOTPRequest(BaseModel):
    identifier: str
    portal: str = "patient"

class VerifyOTPRequest(BaseModel):
    identifier: str
    otp: str

class SendReportRequest(BaseModel):
    email: str
    name: str
    composite: int
    band: str
    scores: dict
    triage: list
    ai_message: Optional[str] = ""

class AdminLoginStep1Request(BaseModel):
    email: str
    password: str

class AdminOTPVerifyRequest(BaseModel):
    email: str
    otp: str

class AdminResendOTPRequest(BaseModel):
    email: str


# Supabase Helpers

def supabase_headers():
    return {
        "apikey":        SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type":  "application/json",
        "Prefer":        "return=minimal"
    }


def get_admin_from_db(email: str):
    try:
        response = httpx.get(
            f"{SUPABASE_URL}/rest/v1/admins",
            headers={
                "apikey":        SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type":  "application/json"
            },
            params={
                "email":     f"eq.{email.strip().lower()}",
                "is_active": "eq.true",
                "select":    "id,email,password_hash,full_name,is_active"
            },
            timeout=5
        )
        print(f"[Supabase] Admin fetch status: {response.status_code}")
        if response.status_code != 200:
            return None
        data = response.json()
        if not data or len(data) == 0:
            print(f"[Supabase] No admin found for: {email}")
            return None
        return data[0]
    except Exception as e:
        print(f"[Supabase] Admin fetch error: {e}")
        return None


def update_admin_last_login(email: str):
    try:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        httpx.patch(
            f"{SUPABASE_URL}/rest/v1/admins",
            headers=supabase_headers(),
            params={"email": f"eq.{email.strip().lower()}"},
            json={"last_login_at": now},
            timeout=5
        )
        print(f"[Supabase] ✓ last_login_at updated for {email}")
    except Exception as e:
        print(f"[Supabase] last_login update error: {e}")


def log_admin_event(email: str, event: str):
    if not SUPABASE_URL or not SUPABASE_KEY:
        print(f"[Supabase log] Skipped — credentials not set. Event: {event}")
        return
    try:
        response = httpx.post(
            f"{SUPABASE_URL}/rest/v1/admin_login_log",
            headers=supabase_headers(),
            json={"email": email, "event": event},
            timeout=5
        )
        if response.status_code not in (200, 201):
            print(f"[Supabase log] Failed: {response.status_code} {response.text}")
        else:
            print(f"[Supabase log] ✓ '{event}' saved for {email}")
    except Exception as e:
        print(f"[Supabase log error] {e}")


# General Helpers

def generate_otp(length: int = 4) -> str:
    return "".join(random.choices(string.digits, k=length))

def redis_key(identifier: str) -> str:
    return f"evr_otp:{identifier.strip().lower()}"

def patient_rate_key(identifier: str) -> str:
    return f"evr_patient_rate:{identifier.strip().lower()}"

def patient_cooldown_key(identifier: str) -> str:
    return f"evr_patient_cd:{identifier.strip().lower()}"

def patient_fail_key(identifier: str) -> str:
    return f"evr_patient_fail:{identifier.strip().lower()}"

def patient_lock_key(identifier: str) -> str:
    return f"evr_patient_lock:{identifier.strip().lower()}"

def is_email(identifier: str) -> bool:
    return "@" in identifier

def _jwt_role(key: str) -> str | None:
    """Read role claim from a Supabase JWT without verifying signature."""
    try:
        parts = (key or "").split(".")
        if len(parts) < 2:
            return None
        payload = parts[1]
        padding = "=" * (-len(payload) % 4)
        data = json.loads(base64.urlsafe_b64decode(payload + padding))
        return data.get("role")
    except Exception:
        return None

def get_public_supabase_key() -> str:
    """Return only a client-safe anon key for /config — never service_role."""
    anon = (SUPABASE_ANON_KEY or "").strip()
    if anon:
        role = _jwt_role(anon)
        if role and role != "anon":
            print(f"[Config] ✗ SUPABASE_ANON_KEY has role '{role}', expected 'anon'")
            return ""
        return anon
    fallback = (SUPABASE_KEY or "").strip()
    if not fallback:
        return ""
    role = _jwt_role(fallback)
    if role == "service_role":
        print("[Config] ✗ Refusing to expose service_role key — set SUPABASE_ANON_KEY in .env")
        return ""
    return fallback

def _check_patient_otp_lock(identifier: str) -> None:
    if r.exists(patient_lock_key(identifier)):
        ttl = r.ttl(patient_lock_key(identifier))
        raise HTTPException(
            429,
            f"Too many failed attempts. Try again in {max(ttl // 60, 1)} minute(s).",
        )

def _check_patient_rate_limit(identifier: str) -> None:
    rate_key = patient_rate_key(identifier)
    send_count = r.get(rate_key)
    if send_count and int(send_count) >= PATIENT_OTP_RATE_LIMIT:
        ttl = r.ttl(rate_key)
        raise HTTPException(
            429,
            f"Too many OTP requests. Try again in {ttl // 60 + 1} minute(s).",
        )

def _increment_patient_rate(identifier: str) -> None:
    rate_key = patient_rate_key(identifier)
    pipe = r.pipeline()
    pipe.incr(rate_key)
    pipe.expire(rate_key, PATIENT_OTP_RATE_WINDOW)
    pipe.execute()

def _issue_patient_otp(identifier: str, portal: str) -> None:
    _check_patient_otp_lock(identifier)
    _check_patient_rate_limit(identifier)
    r.delete(redis_key(identifier))
    otp = generate_otp()
    r.set(redis_key(identifier), otp, ex=PATIENT_OTP_TTL)
    r.set(patient_cooldown_key(identifier), "1", ex=PATIENT_RESEND_COOLDOWN)
    if not send_email_otp(identifier, otp, portal):
        raise HTTPException(502, "Failed to send OTP. Please try again.")
    _increment_patient_rate(identifier)

def admin_otp_key(email: str) -> str:
    return f"evr_admin_otp:{email.strip().lower()}"

def admin_rate_key(email: str) -> str:
    return f"evr_admin_rate:{email.strip().lower()}"

def admin_verified_key(email: str) -> str:
    return f"evr_admin_verified:{email.strip().lower()}"

def admin_cooldown_key(email: str) -> str:
    """30-second cooldown between resend requests."""
    return f"evr_admin_cd:{email.strip().lower()}"

def hash_otp(otp: str) -> str:
    return hashlib.sha256(otp.encode()).hexdigest()


# Email — Patient / HCP OTP

def send_email_otp(to_email: str, otp: str, portal: str) -> bool:
    if not SENDGRID_API_KEY:
        print(f"[DEV] Email OTP for {to_email}: {otp}")
        return True
    portal_label = "Clinician Portal" if portal == "hcp" else "Patient Portal"
    html = render_email_template("otp_patient.html", portal_label=portal_label, otp=otp)
    try:
        sg  = SendGridAPIClient(SENDGRID_API_KEY)
        msg = Mail(from_email=(FROM_EMAIL, FROM_NAME), to_emails=to_email,
                   subject=f"Your EvaEraHealth OTP: {otp}", html_content=html)
        res = sg.send(msg)
        return res.status_code in (200, 201, 202)
    except Exception as e:
        print(f"[SendGrid OTP error] {e}")
        return False


# Email — Admin OTP

def send_admin_otp_email(to_email: str, otp: str) -> bool:
    if not SENDGRID_API_KEY:
        print(f"[DEV] ADMIN OTP for {to_email}: {otp}")
        return True
    html = render_email_template("otp_admin.html", otp=otp)
    try:
        sg  = SendGridAPIClient(SENDGRID_API_KEY)
        msg = Mail(
            from_email=(FROM_EMAIL, FROM_NAME),
            to_emails=to_email,
            subject=f"[EvaEraHealth Admin] Your login OTP: {otp}",
            html_content=html
        )
        res = sg.send(msg)
        return res.status_code in (200, 201, 202)
    except Exception as e:
        print(f"[SendGrid Admin OTP error] {e}")
        return False


# Report Email

def build_report_email(name, composite, band, scores, triage, ai_message):
    rows_html = ""
    for k, v in (scores or {}).items():
        if v is None:
            continue
        rows_html += f"""
        <tr>
          <td style="padding:6px 0;color:#6B7280;font-size:13px">{k.replace('_',' ')}</td>
          <td style="padding:6px 0;text-align:right;font-weight:700;font-size:13px">{v}</td>
        </tr>"""

    triage_html = ""
    for t in (triage or [])[:5]:
        action = t.get("action", "") if isinstance(t, dict) else str(t)
        triage_html += f'<div style="padding:4px 0;font-size:12px;color:#374151">• {action.replace("_"," ")}</div>'

    ai_block = f"""
    <div style="background:#FFF8FC;border:1.5px solid #FCE4EC;border-radius:10px;padding:14px;margin:16px 0;font-size:13px;color:#374151;font-style:italic">
      "{ai_message}"
    </div>""" if ai_message else ""

    recommendations_block = ""
    if triage_html:
        recommendations_block = (
            '<div style="margin-top:10px"><div style="font-size:12px;font-weight:700;color:#0F1E3C;margin-bottom:6px">'
            "Top Recommendations</div>" + triage_html + "</div>"
        )

    return render_email_template(
        "report.html",
        name=name,
        composite=composite,
        band=band,
        ai_block=ai_block,
        rows_html=rows_html,
        recommendations_block=recommendations_block,
    )


def send_report_email(to_email: str, name: str, html_content: str) -> bool:
    if not SENDGRID_API_KEY:
        print(f"[DEV] Report email for {to_email} ({name}) — SendGrid key not set, skipping actual send")
        return True   # dev mode: pretend success so the frontend flow can be tested
    try:
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        msg = Mail(
            from_email=(FROM_EMAIL, FROM_NAME),
            to_emails=to_email,
            subject=f"Your EvaEraHealth Wellness Report, {name}",
            html_content=html_content
        )
        res = sg.send(msg)
        return res.status_code in (200, 201, 202)
    except Exception as e:
        print(f"[SendGrid Report error] {e}")
        return False


class ClinicContactRequest(BaseModel):
    contact_type:  str = "general"
    patient_name:  str = "Patient"
    patient_email: str | None = None
    subject:       str | None = None
    message:       str | None = None
    flags:         list[str] = Field(default_factory=list)


def send_clinic_contact_email(req: ClinicContactRequest) -> bool:
    clinic_to = clinic_email_address()
    subject = req.subject or {
        "gyne":    "Urgent Gynaecology Consultation Request",
        "psych":   "Urgent Mental Health Consultation Request",
        "general": "Patient Contact — EvaEraHealth",
    }.get(req.contact_type, "Patient Contact — EvaEraHealth")

    urgency_labels = {
        "gyne":    "🚨 Urgent gynaecology consultation requested",
        "psych":   "🚨 Urgent mental health support requested",
        "general": "📩 New patient message",
    }
    flags_html = ""
    if req.flags:
        flags_html = (
            "<ul style=\"margin:0;padding-left:18px;font-size:12px;color:#78350F;line-height:1.7\">"
            + "".join(f"<li>{f}</li>" for f in req.flags)
            + "</ul>"
        )

    html = render_email_template(
        "clinic_contact.html",
        urgency_label=urgency_labels.get(req.contact_type, urgency_labels["general"]),
        contact_type=req.contact_type.replace("_", " ").title(),
        patient_name=req.patient_name,
        patient_email=req.patient_email,
        flags_html=flags_html,
        message=req.message or "",
    )

    if not SENDGRID_API_KEY:
        print(f"[DEV] Clinic contact → {clinic_to}: {subject}")
        print(f"[DEV] Patient: {req.patient_name} ({req.patient_email}) flags={req.flags}")
        return True

    try:
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        msg = Mail(
            from_email=(FROM_EMAIL, FROM_NAME),
            to_emails=clinic_to,
            subject=subject,
            html_content=html,
        )
        if req.patient_email and "@" in req.patient_email:
            msg.reply_to = ReplyTo(req.patient_email)
        res = sg.send(msg)
        ok = res.status_code in (200, 201, 202)
        if ok:
            print(f"[SendGrid] ✓ Clinic contact sent to {clinic_to}")
        return ok
    except Exception as e:
        print(f"[SendGrid Clinic contact error] {e}")
        return False


# ─── Google Meet ───────────────────────────────────────────

def _get_calendar_service():
    creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
    if not creds_path or not os.path.isfile(creds_path):
        return None
    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
        scopes = ["https://www.googleapis.com/auth/calendar"]
        creds = service_account.Credentials.from_service_account_file(creds_path, scopes=scopes)
        delegate = os.getenv("GOOGLE_CALENDAR_DELEGATE_EMAIL", "")
        if delegate:
            creds = creds.with_subject(delegate)
        return build("calendar", "v3", credentials=creds, cache_discovery=False)
    except Exception as e:
        print(f"[Meet] Calendar service unavailable: {e}")
        return None


def _parse_appt_datetime(date_str, time_str, duration_min, timezone="Asia/Kolkata"):
    time_str = (time_str or "10:00 AM").strip()
    if "AM" in time_str.upper() or "PM" in time_str.upper():
        dt_obj = datetime.strptime(time_str.upper(), "%I:%M %p")
    else:
        parts = time_str.split(":")
        dt_obj = datetime.strptime(
            f"{parts[0]}:{parts[1] if len(parts) > 1 else '00'}", "%H:%M"
        )
    date_obj = datetime.strptime(date_str, "%Y-%m-%d")
    start_dt = date_obj.replace(
        hour=dt_obj.hour, minute=dt_obj.minute, second=0, microsecond=0
    )
    end_dt = start_dt + timedelta(minutes=duration_min or 30)
    tz = ZoneInfo(timezone)
    return start_dt.replace(tzinfo=tz).isoformat(), end_dt.replace(tzinfo=tz).isoformat()


def _create_meet_via_calendar(summary, date_str, time_str, duration_min, timezone="Asia/Kolkata"):
    service = _get_calendar_service()
    if not service:
        return None
    try:
        start_iso, end_iso = _parse_appt_datetime(date_str, time_str, duration_min, timezone)
        event = {
            "summary": summary,
            "start": {"dateTime": start_iso, "timeZone": timezone},
            "end": {"dateTime": end_iso, "timeZone": timezone},
            "conferenceData": {
                "createRequest": {
                    "requestId": str(uuid.uuid4()),
                    "conferenceSolutionKey": {"type": "hangoutsMeet"},
                }
            },
        }
        cal_id = os.getenv("GOOGLE_CALENDAR_ID", "primary")
        created = service.events().insert(
            calendarId=cal_id,
            body=event,
            conferenceDataVersion=1,
            sendUpdates="none",
        ).execute()
        link = created.get("hangoutLink")
        if not link:
            for ep in created.get("conferenceData", {}).get("entryPoints", []):
                if ep.get("entryPointType") == "video":
                    link = ep.get("uri")
                    break
        if link:
            print(f"[Meet] ✓ Calendar Meet link: {link}")
        return link
    except Exception as e:
        print(f"[Meet] Calendar API failed: {e}")
        return None


def _create_meet_room_fallback():
    import secrets
    chars = "abcdefghijklmnopqrstuvwxyz"

    def part(n):
        return "".join(secrets.choice(chars) for _ in range(n))

    room_id = f"{part(3)}-{part(4)}-{part(3)}"
    link = f"https://meet.google.com/{room_id}"
    print(f"[Meet] ✓ Fallback Meet room: {link}")
    return link


async def _patch_meet_link_to_supabase(booking_id: str, meet_link: str) -> bool:
    if not meet_link or not booking_id or not SUPABASE_URL or not SUPABASE_KEY:
        return False
    try:
        async with httpx.AsyncClient() as client:
            patch_res = await client.patch(
                f"{SUPABASE_URL}/rest/v1/appointments?id=eq.{booking_id}",
                headers={
                    "apikey":        SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "Content-Type":  "application/json",
                    "Prefer":        "return=minimal",
                },
                json={"meet_link": meet_link},
            )
            if patch_res.status_code in (200, 201, 204):
                print(f"[Meet] ✓ meet_link saved for {booking_id}")
                return True
            print(f"[Meet] ✗ Supabase patch failed: {patch_res.status_code} {patch_res.text}")
    except Exception as e:
        print(f"[Meet] ✗ Supabase patch error: {e}")
    return False


def create_google_meet_link(
    summary,
    date_str,
    time_str,
    duration_min,
    patient_email,
    doctor_email,
    timezone="Asia/Kolkata",
) -> str | None:
    """Create a Google Meet link via Calendar API, or fallback room code."""
    link = _create_meet_via_calendar(summary, date_str, time_str, duration_min, timezone)
    if link:
        return link
    return _create_meet_room_fallback()


class MeetLinkRequest(BaseModel):
    booking_id:    str
    patient_name:  str = "Patient"
    doctor_name:   str = "Consultant"
    date:          str
    time:          str
    patient_email: str | None = None
    doctor_email:  str | None = None
    duration_min:  int = 30


@app.post("/generate-meet-link")
async def generate_meet_link_endpoint(req: MeetLinkRequest):
    summary = f"EvaEraHealth — {req.patient_name} with {req.doctor_name}"
    meet_link = create_google_meet_link(
        summary,
        req.date,
        req.time,
        req.duration_min,
        req.patient_email,
        req.doctor_email,
    )
    if not meet_link:
        raise HTTPException(status_code=502, detail="Could not generate Meet link")
    await _patch_meet_link_to_supabase(req.booking_id, meet_link)
    return {"success": True, "meet_link": meet_link}


# ─── REQUEST MODEL ─────────────────────────────────────────

class AppointmentConfirmationRequest(BaseModel):
    patient_email: str | None = None
    patient_name:  str
    doctor_name:   str
    doctor_email:  str | None = None
    date:          str         # "YYYY-MM-DD"
    time:          str         # "10:00 AM"
    mode:          str         # "Video" or "In-Person"
    fee:           int
    booking_id:    str
    meet_link:     str | None = None


# ─── ENDPOINT 

@app.post("/send-appointment-confirmation")
async def send_appointment_confirmation(req: AppointmentConfirmationRequest):

    meet_link = req.meet_link

    # ── Generate Meet link if video 
    is_video = req.mode.lower() in ("video", "online")

    if is_video and not meet_link:
        meet_link = create_google_meet_link(
            summary       = f"EvaEraHealth — {req.patient_name} with {req.doctor_name}",
            date_str      = req.date,
            time_str      = req.time,
            duration_min  = 30,
            patient_email = req.patient_email,
            doctor_email  = req.doctor_email,
        )

        # ── Patch meet_link back into Supabase
        # Uses SUPABASE_KEY (same key your existing code uses)
        if meet_link and req.booking_id:
            await _patch_meet_link_to_supabase(req.booking_id, meet_link)

    mode_label = "📹 Video Call (Online)" if is_video else "🏥 In-Person Visit"
    html_body = render_email_template(
        "appointment_confirmation.html",
        patient_name=req.patient_name,
        doctor_name=req.doctor_name,
        date=req.date,
        time=req.time,
        mode_label=mode_label,
        fee=req.fee,
        booking_id=req.booking_id,
        is_video=is_video,
        meet_link=meet_link,
        **_email_contact_context(),
    )

    # ── Send using your existing SendGrid function ──
    # Reuses send_report_email() which already works in your codebase
    if not req.patient_email:
        return {
            "success":   True,
            "meet_link": meet_link,
            "message":   "No patient email provided — email skipped"
        }

    try:
        sg  = SendGridAPIClient(SENDGRID_API_KEY)
        msg = Mail(
            from_email    = (FROM_EMAIL, FROM_NAME),
            to_emails     = req.patient_email,
            subject       = f"Appointment Confirmed — {req.doctor_name} on {req.date} at {req.time}",
            html_content  = html_body,
        )
        res = sg.send(msg)
        if res.status_code in (200, 201, 202):
            print(f"[Email] ✓ Confirmation sent to {req.patient_email}")
        else:
            print(f"[Email] ✗ SendGrid returned {res.status_code}")

        return {
            "success":   True,
            "meet_link": meet_link
        }

    except Exception as e:
        print(f"[Email] ✗ Send failed: {e}")
        if meet_link:
            return {
                "success":   False,
                "meet_link": meet_link,
                "message":   f"Email failed but Meet link was created: {e}",
            }
        raise HTTPException(status_code=500, detail=str(e))


# Appointment update emails (cancel / reschedule / mode change)

class AppointmentUpdateRequest(BaseModel):
    update_type:   str          # cancelled | rescheduled | mode_changed
    patient_email: str | None = None
    patient_name:  str
    doctor_name:   str
    date:          str
    time:          str
    mode:          str | None = None
    booking_id:    str
    old_date:      str | None = None
    old_time:      str | None = None
    new_date:      str | None = None
    new_time:      str | None = None
    new_mode:      str | None = None
    meet_link:     str | None = None


def _send_appointment_update_email(req: AppointmentUpdateRequest) -> bool:
    if not req.patient_email:
        print(f"[DEV] Appt update ({req.update_type}) — no patient email")
        return True
    if not SENDGRID_API_KEY:
        print(f"[DEV] Appt update ({req.update_type}) for {req.patient_email}: {req.booking_id}")
        return True

    titles = {
        "cancelled":    "Appointment Cancelled",
        "rescheduled":  "Appointment Rescheduled",
        "mode_changed": "Consultation Mode Updated",
    }
    status_messages = {
        "cancelled":    "Your appointment has been cancelled",
        "rescheduled":  "Your appointment has been rescheduled",
        "mode_changed": "Your consultation mode has been updated",
    }
    title = titles.get(req.update_type, "Appointment Updated")
    banner_class = {
        "cancelled": "cancelled",
        "rescheduled": "rescheduled",
        "mode_changed": "mode_changed",
    }.get(req.update_type, "default")
    status_message = status_messages.get(req.update_type, "Your appointment has been updated")

    intro = {
        "cancelled":   f"Hi {req.patient_name}, we've processed your cancellation request. If a refund applies, it will arrive within 5–7 business days.",
        "rescheduled": f"Hi {req.patient_name}, your appointment has been moved successfully. Please review your updated details below.",
        "mode_changed": f"Hi {req.patient_name}, your consultation mode has been updated. See the details and preparation notes below.",
    }.get(req.update_type, f"Hi {req.patient_name}, your appointment details have been updated.")

    detail_rows = ""
    if req.update_type == "rescheduled" and req.old_date and req.new_date:
        detail_rows = f"""
          <tr style="border-top:1px solid #EEF2F7">
            <td style="padding:8px 0;color:#64748B">📅 Previous</td>
            <td style="padding:8px 0;text-align:right;color:#64748B">{req.old_date} · {req.old_time or ''}</td>
          </tr>
          <tr style="border-top:1px solid #EEF2F7">
            <td style="padding:8px 0;color:#64748B">📅 New</td>
            <td style="padding:8px 0;text-align:right;font-weight:700;color:#0F1E3C">{req.new_date} · {req.new_time or ''}</td>
          </tr>
        """
    elif req.update_type == "mode_changed" and req.new_mode:
        detail_rows = f"""
          <tr style="border-top:1px solid #EEF2F7">
            <td style="padding:8px 0;color:#64748B">📡 New mode</td>
            <td style="padding:8px 0;text-align:right;font-weight:700;color:#0F1E3C">{req.new_mode}</td>
          </tr>
          <tr style="border-top:1px solid #EEF2F7">
            <td style="padding:8px 0;color:#64748B">📅 Date &amp; time</td>
            <td style="padding:8px 0;text-align:right;font-weight:700;color:#0F1E3C">{req.date} · {req.time}</td>
          </tr>
        """
    else:
        detail_rows = f"""
          <tr style="border-top:1px solid #EEF2F7">
            <td style="padding:8px 0;color:#64748B">📅 Date &amp; time</td>
            <td style="padding:8px 0;text-align:right;font-weight:700;color:#0F1E3C">{req.date} · {req.time}</td>
          </tr>
        """

    effective_mode = req.new_mode if req.update_type == "mode_changed" else req.mode
    mode_row = ""
    if effective_mode and req.update_type not in ("mode_changed", "cancelled"):
        mode_row = f"""<tr style="border-top:1px solid #EEF2F7"><td style="padding:8px 0;color:#64748B">📡 Mode</td>
              <td style="padding:8px 0;text-align:right;font-weight:700;color:#0F1E3C">{effective_mode}</td></tr>"""

    is_video = _is_video_mode(effective_mode)
    show_prep = req.update_type != "cancelled"

    html = render_email_template(
        "appointment_update.html",
        title=title,
        banner_class=banner_class,
        status_message=status_message,
        intro=intro,
        doctor_name=req.doctor_name,
        detail_rows=detail_rows,
        mode_row=mode_row,
        booking_id=req.booking_id,
        is_video=is_video,
        meet_link=req.meet_link,
        show_prep=show_prep,
        **_email_contact_context(),
    )

    subjects = {
        "cancelled":   f"Appointment Cancelled — {req.doctor_name}",
        "rescheduled": f"Appointment Rescheduled — {req.doctor_name} on {req.new_date or req.date}",
        "mode_changed": f"Mode Updated — {req.doctor_name} on {req.date}",
    }

    try:
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        msg = Mail(
            from_email=(FROM_EMAIL, FROM_NAME),
            to_emails=req.patient_email,
            subject=subjects.get(req.update_type, "Appointment Update — EvaEraHealth"),
            html_content=html,
        )
        res = sg.send(msg)
        return res.status_code in (200, 201, 202)
    except Exception as e:
        print(f"[SendGrid Appt update error] {e}")
        return False


@app.post("/send-appointment-update")
async def send_appointment_update(req: AppointmentUpdateRequest):
    allowed = ("cancelled", "rescheduled", "mode_changed")
    if req.update_type not in allowed:
        raise HTTPException(400, f"update_type must be one of: {', '.join(allowed)}")
    if not req.patient_email:
        return {"success": True, "message": "No patient email — email skipped"}
    if not _send_appointment_update_email(req):
        raise HTTPException(502, "Failed to send update email")
    print(f"[Email] ✓ {req.update_type} email sent to {req.patient_email}")
    return {"success": True, "message": f"Update email sent to {req.patient_email}"}


class AppointmentCompletedRequest(BaseModel):
    patient_email: str | None = None
    patient_name:  str
    doctor_name:   str
    date:          str
    time:          str
    mode:          str | None = None
    booking_id:    str


def _send_appointment_completed_email(req: AppointmentCompletedRequest) -> bool:
    if not req.patient_email:
        print(f"[DEV] Appt completed — no patient email ({req.booking_id})")
        return True
    if not SENDGRID_API_KEY:
        print(f"[DEV] Appt completed email for {req.patient_email}: {req.booking_id}")
        return True

    is_video = _is_video_mode(req.mode)
    mode_label = "📹 Video Call (Online)" if is_video else "🏥 In-Person Visit"

    html = render_email_template(
        "appointment_completed.html",
        patient_name=req.patient_name,
        doctor_name=req.doctor_name,
        date=req.date,
        time=req.time,
        mode_label=mode_label,
        booking_id=req.booking_id,
        is_video=is_video,
        **_email_contact_context(),
    )

    try:
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        msg = Mail(
            from_email=(FROM_EMAIL, FROM_NAME),
            to_emails=req.patient_email,
            subject="Consultation Completed — Thank You for Visiting EvaEraHealth",
            html_content=html,
        )
        res = sg.send(msg)
        return res.status_code in (200, 201, 202)
    except Exception as e:
        print(f"[SendGrid Appt completed error] {e}")
        return False


@app.post("/send-appointment-completed")
async def send_appointment_completed(req: AppointmentCompletedRequest):
    if not req.patient_email:
        return {"success": True, "message": "No patient email — email skipped"}
    if not _send_appointment_completed_email(req):
        raise HTTPException(502, "Failed to send completion email")
    print(f"[Email] ✓ Completion email sent to {req.patient_email}")
    return {"success": True, "message": f"Completion email sent to {req.patient_email}"}


@app.post("/send-otp")
def send_otp(body: SendOTPRequest):
    identifier = body.identifier.strip().lower()
    if not identifier:
        raise HTTPException(400, "identifier is required")
    if not is_email(identifier):
        raise HTTPException(400, "Please enter a valid email address")
    _issue_patient_otp(identifier, body.portal)
    return {"success": True, "message": f"OTP sent to {identifier}"}


@app.post("/verify-otp")
def verify_otp(body: VerifyOTPRequest):
    identifier = body.identifier.strip().lower()
    otp        = body.otp.strip()
    if not identifier or not otp:
        raise HTTPException(400, "identifier and otp are required")
    _check_patient_otp_lock(identifier)
    stored = r.get(redis_key(identifier))
    if stored is None:
        raise HTTPException(404, "OTP expired or already used. Please request a new one.")
    if stored != otp:
        fail_key = patient_fail_key(identifier)
        fails = r.incr(fail_key)
        if fails == 1:
            r.expire(fail_key, PATIENT_VERIFY_LOCKOUT)
        if fails >= PATIENT_VERIFY_MAX_FAILS:
            r.delete(redis_key(identifier))
            r.set(patient_lock_key(identifier), "1", ex=PATIENT_VERIFY_LOCKOUT)
            raise HTTPException(
                429,
                "Too many invalid attempts. Please request a new OTP later.",
            )
        raise HTTPException(401, "Invalid OTP. Please try again.")
    r.delete(redis_key(identifier))
    r.delete(patient_fail_key(identifier))
    r.delete(patient_lock_key(identifier))
    return {"success": True, "message": "OTP verified successfully"}


@app.post("/resend-otp")
def resend_otp(body: SendOTPRequest):
    identifier = body.identifier.strip().lower()
    if not identifier:
        raise HTTPException(400, "identifier is required")
    if not is_email(identifier):
        raise HTTPException(400, "Please enter a valid email address")
    cd_key = patient_cooldown_key(identifier)
    if r.exists(cd_key):
        ttl = r.ttl(cd_key)
        raise HTTPException(429, f"Please wait {ttl} seconds before requesting a new OTP.")
    _issue_patient_otp(identifier, body.portal)
    return {"success": True, "message": f"New OTP sent to {identifier}"}


# Admin 2FA Routes

@app.post("/admin/login")
def admin_login_step1(body: AdminLoginStep1Request):
    email = body.email.strip().lower()

    # 1. Fetch admin from Supabase
    admin = get_admin_from_db(email)
    if not admin:
        log_admin_event(email, "step1_fail_email")
        raise HTTPException(401, "Invalid credentials")

    # 2. Verify password
    try:
        password_matches = bcrypt.checkpw(
            body.password.encode(),
            admin["password_hash"].encode()
        )
    except Exception as e:
        print(f"[bcrypt error] {e}")
        password_matches = False

    if not password_matches:
        log_admin_event(email, "step1_fail_password")
        raise HTTPException(401, "Invalid credentials")

    # 3. Rate limit (max 3 per 15 min)
    rate_key   = admin_rate_key(email)
    send_count = r.get(rate_key)
    if send_count and int(send_count) >= ADMIN_OTP_RATE_LIMIT:
        ttl = r.ttl(rate_key)
        log_admin_event(email, "rate_limited")
        raise HTTPException(429, f"Too many OTP requests. Try again in {ttl // 60 + 1} minute(s).")

    # 4. Delete old OTP
    r.delete(admin_otp_key(email))

    # 5. Generate new OTP and store hash
    otp = "".join(random.choices(string.digits, k=6))
    r.set(admin_otp_key(email), hash_otp(otp), ex=ADMIN_OTP_TTL)

    # 6. Mark step-1 passed
    r.set(admin_verified_key(email), "1", ex=600)

    # 7. Set 30 second resend cooldown
    r.set(admin_cooldown_key(email), "1", ex=ADMIN_RESEND_COOLDOWN)

    # 8. Increment rate counter
    pipe = r.pipeline()
    pipe.incr(rate_key)
    pipe.expire(rate_key, ADMIN_OTP_RATE_WINDOW)
    pipe.execute()

    # 9. Send OTP email
    if not send_admin_otp_email(email, otp):
        raise HTTPException(502, "Failed to send OTP email. Please try again.")

    # 10. Log to Supabase
    log_admin_event(email, "otp_sent")

    return {
        "success": True,
        "message": f"OTP sent to {email}. Valid for 5 minutes.",
        "admin_name": admin.get("full_name", "Admin")
    }


@app.post("/admin/verify-otp")
def admin_verify_otp(body: AdminOTPVerifyRequest):
    email = body.email.strip().lower()
    otp   = body.otp.strip()

    if not otp or len(otp) != 6 or not otp.isdigit():
        raise HTTPException(400, "OTP must be 6 digits")

    # Must have completed step-1
    if not r.exists(admin_verified_key(email)):
        raise HTTPException(403, "Please complete email and password verification first.")

    # Get stored hash
    stored_hash = r.get(admin_otp_key(email))
    if stored_hash is None:
        raise HTTPException(404, "OTP expired or already used. Please request a new one.")

    # Compare
    if not hmac.compare_digest(stored_hash, hash_otp(otp)):
        log_admin_event(email, "otp_fail")
        raise HTTPException(401, "Invalid OTP. Please try again.")

    # ✅ Success — clean up all Redis keys
    r.delete(admin_otp_key(email))
    r.delete(admin_verified_key(email))
    r.delete(admin_rate_key(email))
    r.delete(admin_cooldown_key(email))

    # Update last login in Supabase
    update_admin_last_login(email)

    # Log success
    log_admin_event(email, "login_success")

    return {
        "success": True,
        "message": "Admin authenticated successfully.",
        "admin_email": email
    }


@app.post("/admin/resend-otp")
def admin_resend_otp(body: AdminResendOTPRequest):
    email = body.email.strip().lower()

    # Must have completed step-1
    if not r.exists(admin_verified_key(email)):
        raise HTTPException(403, "Please complete email and password verification first.")

    # ── 30 second cooldown check 
    cd_key = admin_cooldown_key(email)
    if r.exists(cd_key):
        ttl = r.ttl(cd_key)
        raise HTTPException(429, f"Please wait {ttl} seconds before requesting a new OTP.")

    # Rate limit (max 3 per 15 min)
    rate_key   = admin_rate_key(email)
    send_count = r.get(rate_key)
    if send_count and int(send_count) >= ADMIN_OTP_RATE_LIMIT:
        ttl = r.ttl(rate_key)
        log_admin_event(email, "rate_limited")
        raise HTTPException(429, f"Too many OTP requests. Try again in {ttl // 60 + 1} minute(s).")

    # Delete old OTP and generate new one
    r.delete(admin_otp_key(email))
    otp = "".join(random.choices(string.digits, k=6))
    r.set(admin_otp_key(email), hash_otp(otp), ex=ADMIN_OTP_TTL)
    r.set(admin_verified_key(email), "1", ex=600)

    # Set fresh 30 second cooldown
    r.set(cd_key, "1", ex=ADMIN_RESEND_COOLDOWN)

    # Increment rate counter
    pipe = r.pipeline()
    pipe.incr(rate_key)
    pipe.expire(rate_key, ADMIN_OTP_RATE_WINDOW)
    pipe.execute()

    # Send new OTP email
    if not send_admin_otp_email(email, otp):
        raise HTTPException(502, "Failed to resend OTP. Please try again.")

    log_admin_event(email, "otp_sent")
    return {"success": True, "message": f"New OTP sent to {email}"}


# Report Route

@app.post("/send-clinic-contact")
def send_clinic_contact(body: ClinicContactRequest):
    clinic_to = clinic_email_address()
    if not send_clinic_contact_email(body):
        raise HTTPException(502, "Failed to send email to clinic. Please try again or call the clinic.")
    return {
        "success": True,
        "message": f"Your message has been sent to the clinic ({clinic_to}). We will contact you soon.",
        "clinic_email": clinic_to,
    }


@app.post("/send-report")
def send_report(body: SendReportRequest):
    email = body.email.strip()
    if not email or "@" not in email:
        raise HTTPException(400, "Please provide a valid email address")
    html = build_report_email(
        name=body.name,
        composite=body.composite,
        band=body.band,
        scores=body.scores,
        triage=body.triage,
        ai_message=body.ai_message or "",
    )
    if not send_report_email(email, body.name, html):
        raise HTTPException(502, "Failed to send report email. Please try again.")
    return {"success": True, "message": f"Report sent to {email}"}

@app.get("/config")
def get_client_config():
    anon_key = get_public_supabase_key()
    if not SUPABASE_URL or not anon_key:
        raise HTTPException(
            503,
            "Client config unavailable. Set SUPABASE_URL and SUPABASE_ANON_KEY (anon key only).",
        )
    return {
        "supabase_url": SUPABASE_URL,
        "supabase_key": anon_key,
        "clinic_email": clinic_email_address(),
    }


@app.get("/health")
def health():
    try:
        r.ping()
        return {"status": "ok", "redis": "connected"}
    except Exception:
        return {"status": "degraded", "redis": "disconnected"}