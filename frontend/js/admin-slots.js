// EvaEraHealth — Admin Weekly Slot Management 

var _slWkOff       = 0;
var _SL_TIMES_KEY  = 'evh_wk_times';
var _SL_AVAIL_KEY  = 'evh_wk_avail';
var _SL_DAYS_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
var _SL_AM         = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30'];
var _SL_PM         = ['13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30'];
var _SL_ALL_TIMES  = _SL_AM.concat(_SL_PM);

var _SL_STATES = {
  full:  { label: 'Full day',    slotTimes: _SL_ALL_TIMES },
  am:    { label: 'First Half',  slotTimes: _SL_AM        },
  pm:    { label: 'Second Half', slotTimes: _SL_PM        },
  leave: { label: 'Leave',       slotTimes: []            },
  none:  { label: '–',           slotTimes: []            }
};

// SUPABASE HELPERS 
function _slSbUrl()     { return window.SUPABASE_URL || ''; }
function _slSbKey()     { return window.SUPABASE_KEY || ''; }
function _slSbHeaders() {
  return {
    'Content-Type':  'application/json',
    'apikey':        _slSbKey(),
    'Authorization': 'Bearer ' + _slSbKey(),
    'Prefer':        'return=representation'
  };
}
function _slActiveConsultants() {
  return (_admConCache && _admConCache.length)
    ? _admConCache.filter(function(c) { return c.active; })
    : iLd(IK.cn, []).filter(function(c) { return c.active; });
}

function _slFindConsultant(conId) {
  var cons = (_admConCache && _admConCache.length) ? _admConCache : iLd(IK.cn, []);
  return cons.find(function(c) { return c.id === conId; }) || null;
}

function _slSbReady() { return !!(_slSbUrl() && _slSbKey()); }

// LOCAL STORAGE HELPERS 
function _slGetTimes()   { return iLd(_SL_TIMES_KEY, {}); }
function _slSaveTimes(t) { iSv(_SL_TIMES_KEY, t); }
function _slGetAvail()   { return iLd(_SL_AVAIL_KEY, {}); }
function _slSaveAvail(a) { iSv(_SL_AVAIL_KEY, a); }

function _slAvailKey(cid, wkStart, di)   { return cid + '_' + wkStart + '_' + di; }
function _slTimeKey(cid, wkStart, di, t) { return cid + '_' + wkStart + '_' + di + '_' + t; }

function _slGetDayState(cid, wkStart, di) {
  return _slGetAvail()[_slAvailKey(cid, wkStart, di)] || 'none';
}
function _slSetDayState(cid, wkStart, di, state) {
  var a = _slGetAvail();
  a[_slAvailKey(cid, wkStart, di)] = state;
  _slSaveAvail(a);
  _slSyncFineSlots(cid, wkStart, di, state);
}

function _slSyncFineSlots(cid, wkStart, di, state) {
  if (state === 'leave' || state === 'none') {
    var ts = _slGetTimes();
    _SL_ALL_TIMES.forEach(function(t) {
      ts[_slTimeKey(cid, wkStart, di, t)] = false;
    });
    _slSaveTimes(ts);
  }
}

function _slGetSlotActive(cid, wkStart, di, t) {
  return !!_slGetTimes()[_slTimeKey(cid, wkStart, di, t)];
}
function _slToggleSlot(cid, wkStart, di, t) {
  var ts = _slGetTimes();
  var k  = _slTimeKey(cid, wkStart, di, t);
  ts[k]  = !ts[k];
  _slSaveTimes(ts);
}

function _slActiveCount(cid, wkStart, di) {
  var count = 0;
  _SL_ALL_TIMES.forEach(function(t) {
    if (_slGetSlotActive(cid, wkStart, di, t)) count++;
  });
  return count;
}

//  DATE HELPERS 
function _slMon(offset) {
  var d    = new Date();
  var day  = d.getDay();
  var diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}
function _slDateStr(d) {
  var yyyy = d.getFullYear();
  var mm   = String(d.getMonth() + 1).padStart(2, '0');
  var dd   = String(d.getDate()).padStart(2, '0');
  return yyyy + '-' + mm + '-' + dd;
}
function _slDayOfWeek(dateStr) {
  var p = dateStr.split('-');
  var d = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
  return (d.getDay() + 6) % 7;
}
function _slWkStart(off) { return _slDateStr(_slMon(off)); }
function _slWeekLabel(off) {
  var mon = _slMon(off);
  var sun = new Date(mon); sun.setDate(sun.getDate() + 6);
  var mo  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var fmt = function(dt) { return dt.getDate() + ' ' + mo[dt.getMonth()]; };
  return fmt(mon) + ' – ' + fmt(sun) + ' ' + sun.getFullYear();
}
function _slFmt(t) {
  var p   = t.split(':');
  var h   = parseInt(p[0]);
  var m   = p[1];
  var ap  = h >= 12 ? 'PM' : 'AM';
  var h12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
  return h12 + ':' + m + ' ' + ap;
}

// RENDER GRID 
var _slInitLoaded = false;  // ensures DB sync on first render each page load

function admRSl() {
  var el = document.getElementById('adm-wk-slot-root');
  if (!el) return;

  if (!_slInitLoaded) {
    _slInitLoaded = true;
    _slLoadWeekFromDb(_slWkOff);
    return;
  }

  var cons = _slActiveConsultants();
  var wkStart = _slWkStart(_slWkOff);
  var mon     = _slMon(_slWkOff);

  // MOVED: tpl-sl-week-grid + sub-templates
  el.innerHTML = '';
  var gridRoot = mountTemplate('tpl-sl-week-grid', el);
  if (!gridRoot) return;

  var topHost = gridRoot.querySelector('[data-fill="topBar"]');
  if (topHost) {
    var topFrag = cloneTemplate('tpl-sl-topbar');
    if (topFrag && topFrag.firstElementChild) {
      var topBar = topFrag.firstElementChild;
      fillTemplate(topBar, { weekLabel: _slWeekLabel(_slWkOff) });
      topBar.querySelectorAll('[data-action="slPrevWk"]').forEach(function(b) { b.addEventListener('click', _slPrevWk); });
      topBar.querySelectorAll('[data-action="slNextWk"]').forEach(function(b) { b.addEventListener('click', _slNextWk); });
      topBar.querySelectorAll('[data-action="slSaveWeek"]').forEach(function(b) { b.addEventListener('click', _slSaveWeek); });
      topHost.appendChild(topBar);
    }
  }

  var legendHost = gridRoot.querySelector('[data-fill="legend"]');
  if (legendHost) {
    var legFrag = cloneTemplate('tpl-sl-legend');
    if (legFrag && legFrag.firstElementChild) {
      var legend = legFrag.firstElementChild;
      var items = legend.querySelector('[data-list="items"]');
      if (items) {
        [
          ['#3B6D11', 'Full day (9am–5:30pm)'],
          ['#185FA5', 'First Half (9am–12:30pm)'],
          ['#854F0B', 'Second Half (1pm–5:30pm)'],
          ['#A32D2D', 'Leave / holiday']
        ].forEach(function(spec) {
          var iFrag = cloneTemplate('tpl-sl-legend-item');
          if (!iFrag || !iFrag.firstElementChild) return;
          var item = iFrag.firstElementChild;
          var dot = item.querySelector('.sl-wk-legend-dot');
          if (dot) dot.style.background = spec[0];
          fillTemplate(item, { label: spec[1] });
          items.appendChild(item);
        });
      }
      legendHost.appendChild(legend);
    }
  }

  if (!cons.length) {
    var emptyHost = gridRoot.querySelector('[data-fill="table"]');
    if (emptyHost) mountTemplate('tpl-sl-empty-cons', emptyHost);
    return;
  }

  var tableHost = gridRoot.querySelector('[data-fill="table"]');
  if (tableHost) {
    var tblFrag = cloneTemplate('tpl-sl-week-table');
    if (tblFrag && tblFrag.firstElementChild) {
      var tableWrap = tblFrag.firstElementChild;
      var headRow = tableWrap.querySelector('thead tr');
      if (headRow) {
        var clinTh = document.createElement('th');
        clinTh.className = 'sl-wk-th sl-wk-th--clinician';
        clinTh.textContent = 'Clinician';
        headRow.appendChild(clinTh);
        for (var di = 0; di < 7; di++) {
          var d = new Date(mon); d.setDate(d.getDate() + di);
          var isToday = _slDateStr(d) === _slDateStr(new Date());
          var thFrag = cloneTemplate('tpl-sl-week-th');
          if (!thFrag || !thFrag.firstElementChild) continue;
          var th = thFrag.firstElementChild;
          if (isToday) th.classList.add('sl-wk-th--today');
          fillTemplate(th, { day: _SL_DAYS_SHORT[di], date: String(d.getDate()) });
          headRow.appendChild(th);
        }
      }
      var tbody = tableWrap.querySelector('tbody[data-list="rows"]');
      if (tbody) {
        cons.forEach(function(c) {
          var rowFrag = cloneTemplate('tpl-sl-week-row');
          if (!rowFrag || !rowFrag.firstElementChild) return;
          var tr = rowFrag.firstElementChild;
          fillTemplate(tr, { name: c.name, spec: c.spec });
          for (var di2 = 0; di2 < 7; di2++) {
            var cellEl = _slWeekCellEl(c, di2, wkStart);
            if (cellEl) tr.appendChild(cellEl);
          }
          tbody.appendChild(tr);
        });
      }
      tableHost.appendChild(tableWrap);
    }
  }

  var summaryHost = gridRoot.querySelector('[data-fill="summary"]');
  if (summaryHost) _slMountWeekSummary(summaryHost, cons, wkStart);

  cons.forEach(function(c) {
    for (var di = 0; di < 7; di++) {
      (function(cid, dayIndex) {
        var cell = document.getElementById('_slcell_' + cid + '_' + dayIndex);
        if (cell) cell.addEventListener('click', function(e) {
          e.stopPropagation();
          _slOpenPicker(cid, dayIndex, wkStart, e.currentTarget);
        });
      })(c.id, di);
    }
  });
}

function _slWeekCellEl(c, di, wkStart) {
  var state = _slGetDayState(c.id, wkStart, di);
  var count = _slActiveCount(c.id, wkStart, di);
  var labelMap = { full: 'Full day', am: 'First Half', pm: 'Second Half', leave: 'Leave', none: '+ Set' };
  var cellFrag = cloneTemplate('tpl-sl-week-cell');
  if (!cellFrag || !cellFrag.firstElementChild) return null;
  var td = cellFrag.firstElementChild;
  var inner = td.querySelector('.sl-wk-cell-inner');
  if (!inner) return td;
  inner.id = '_slcell_' + c.id + '_' + di;
  var badgeFrag = cloneTemplate('tpl-sl-cell-badge');
  if (badgeFrag && badgeFrag.firstElementChild) {
    var badgeWrap = badgeFrag.firstElementChild;
    var badge = badgeWrap.querySelector('.sl-wk-badge');
    if (badge) {
      badge.className = 'sl-wk-badge sl-wk-badge--' + state;
      badge.textContent = labelMap[state];
    }
    var slotEl = badgeWrap.querySelector('.sl-wk-slot-count');
    if (slotEl) {
      if (state !== 'none' && state !== 'leave') {
        slotEl.textContent = count + ' slot' + (count === 1 ? '' : 's');
      } else {
        slotEl.style.display = 'none';
      }
    }
    inner.appendChild(badgeWrap);
  }
  return td;
}

function _slMountWeekSummary(host, cons, wkStart) {
  var totalSlots = 0, activeDays = 0, leaveDays = 0;
  cons.forEach(function(c) {
    for (var di = 0; di < 7; di++) {
      var state = _slGetDayState(c.id, wkStart, di);
      var count = _slActiveCount(c.id, wkStart, di);
      if (state === 'leave') leaveDays++;
      if (state !== 'none' && state !== 'leave') { activeDays++; totalSlots += count; }
    }
  });
  var sumFrag = cloneTemplate('tpl-sl-summary');
  if (!sumFrag || !sumFrag.firstElementChild) return;
  var summary = sumFrag.firstElementChild;
  var chips = summary.querySelector('[data-list="chips"]');
  if (!chips) return;
  function addChip(cls, text) {
    var f = cloneTemplate('tpl-sl-summary-chip');
    if (!f || !f.firstElementChild) return;
    var chip = f.firstElementChild;
    chip.className = 'sl-wk-summary-chip ' + cls;
    fillTemplate(chip, { text: text });
    chips.appendChild(chip);
  }
  addChip('sl-wk-summary-chip--slots', '🟢 ' + totalSlots + ' total slots');
  addChip('sl-wk-summary-chip--days', '📅 ' + activeDays + ' active days');
  if (leaveDays) addChip('sl-wk-summary-chip--leave', '🔴 ' + leaveDays + ' leave day' + (leaveDays === 1 ? '' : 's'));
  host.appendChild(summary);
}

function _slPopupRow(host, opts, isActive, onClick) {
  var frag = cloneTemplate('tpl-slot-sheet-row');
  if (!frag || !frag.firstElementChild) return;
  var row = frag.firstElementChild;
  var dot = row.querySelector('.sl-popup__dot');
  if (dot) dot.style.background = opts.dotColor;
  fillTemplate(row, { label: opts.label, meta: opts.meta || '' });
  if (isActive) row.classList.add('is-active');
  row.addEventListener('click', onClick);
  host.appendChild(row);
}
function _slPopupDivider(host) {
  var frag = cloneTemplate('tpl-slot-popup-divider');
  if (frag && frag.firstElementChild) host.appendChild(frag.firstElementChild);
}

function _slOpenPicker(cid, di, wkStart, anchor) {
  _slClosePicker();
  // MOVED: tpl-slot-popup
  var frag = cloneTemplate('tpl-slot-popup');
  if (!frag || !frag.firstElementChild) return;
  var popup = frag.firstElementChild;
  popup.id = '_sl-picker';
  var rect = anchor.getBoundingClientRect();
  var scrollY = window.scrollY || document.documentElement.scrollTop;
  popup.style.left = Math.max(4, rect.left) + 'px';
  popup.style.top = (rect.bottom + scrollY + 4) + 'px';
  var host = listHost(popup, 'rows');
  if (!host) return;
  var currentState = _slGetDayState(cid, wkStart, di);
  var drawerOpts = [
    { key: 'full', label: 'Full day', meta: '9am – 5:30pm', dotColor: '#3B6D11', showHalf: 'both' },
    { key: 'am', label: 'First Half', meta: '9am – 12:30pm', dotColor: '#185FA5', showHalf: 'am' },
    { key: 'pm', label: 'Second Half', meta: '1pm – 5:30pm', dotColor: '#854F0B', showHalf: 'pm' }
  ];
  drawerOpts.forEach(function(o) {
    _slPopupRow(host, o, currentState === o.key, function(e) {
      e.stopPropagation();
      _slSetDayState(cid, wkStart, di, o.key);
      _slClosePicker();
      _slOpenDrawer(cid, di, wkStart, o.showHalf);
    });
  });
  _slPopupDivider(host);
  _slPopupRow(host, { label: 'Leave / holiday', meta: 'No slots', dotColor: '#A32D2D' }, currentState === 'leave', function(e) {
    e.stopPropagation();
    _slSetDayState(cid, wkStart, di, 'leave');
    _slClosePicker();
    admRSl();
  });
  _slPopupRow(host, { label: 'Not set', meta: '', dotColor: '#CBD5E1' }, currentState === 'none', function(e) {
    e.stopPropagation();
    _slSetDayState(cid, wkStart, di, 'none');
    _slClosePicker();
    admRSl();
  });
  _slPopupDivider(host);
  var cFrag = cloneTemplate('tpl-slot-popup-custom');
  if (cFrag && cFrag.firstElementChild) {
    var customRow = cFrag.firstElementChild;
    customRow.addEventListener('click', function(e) {
      e.stopPropagation();
      _slClosePicker();
      _slOpenDrawer(cid, di, wkStart, 'both');
    });
    host.appendChild(customRow);
  }
  document.body.appendChild(popup);
  setTimeout(function() { document.addEventListener('click', _slClosePicker, { once: true }); }, 0);
}

function _slClosePicker() {
  var old = document.getElementById('_sl-picker');
  if (old) old.remove();
}

// WEEK SUMMARY CHIPS 

// WEEK NAVIGATION 
function _slPrevWk() { _slWkOff--; _slLoadWeekFromDb(_slWkOff); }
function _slNextWk() { _slWkOff++; _slLoadWeekFromDb(_slWkOff); }

function _slOpenDrawer(cid, di, wkStart, showHalf) {
  var con = _slFindConsultant(cid);
  var cname = con ? con.name : cid;
  var mon = _slMon(_slWkOff);
  var dayD = new Date(mon); dayD.setDate(dayD.getDate() + di);
  var mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var dayLabel = _SL_DAYS_SHORT[di] + ' ' + dayD.getDate() + ' ' + mo[dayD.getMonth()];
  var subtitleMap = {
    am: 'Select morning slots  ·  9:00 AM – 12:30 PM',
    pm: 'Select afternoon slots  ·  1:00 PM – 5:30 PM',
    both: 'Select individual slots  ·  9:00 AM – 5:30 PM'
  };
  var old = document.getElementById('_sl-drawer-overlay');
  if (old) old.remove();
  // MOVED: tpl-slot-sheet
  var frag = cloneTemplate('tpl-slot-sheet');
  if (!frag || !frag.firstElementChild) return;
  var overlay = frag.firstElementChild;
  overlay.id = '_sl-drawer-overlay';
  fillTemplate(overlay, {
    title: cname + ' — ' + dayLabel,
    sub: subtitleMap[showHalf] || subtitleMap.both
  });
  var countEl = overlay.querySelector('#_sl-drawer-count');
  function _updateCount() {
    if (!countEl) return;
    var n = _slActiveCount(cid, wkStart, di);
    countEl.textContent = n === 0 ? 'No slots selected yet' : n + ' slot' + (n === 1 ? '' : 's') + ' selected';
  }
  _updateCount();
  var sectionsHost = listHost(overlay, 'sections');
  function _slRenderSlotBtn(grid, t) {
    var bFrag = cloneTemplate('tpl-slot-sheet-slot-btn');
    if (!bFrag || !bFrag.firstElementChild) return;
    var btn = bFrag.firstElementChild;
    btn.id = '_slbtn_' + t.replace(':', '');
    btn.textContent = _slFmt(t);
    if (_slGetSlotActive(cid, wkStart, di, t)) btn.classList.add('is-active');
    btn.addEventListener('click', function() {
      _slToggleSlot(cid, wkStart, di, t);
      btn.classList.toggle('is-active', _slGetSlotActive(cid, wkStart, di, t));
      _updateCount();
    });
    grid.appendChild(btn);
  }
  function renderSection(sectionLabel, times) {
    var sFrag = cloneTemplate('tpl-slot-sheet-section');
    if (!sFrag || !sFrag.firstElementChild || !sectionsHost) return;
    var section = sFrag.firstElementChild;
    fillTemplate(section, { label: sectionLabel });
    var grid = section.querySelector('[data-list="slots"]');
    times.forEach(function(t) { _slRenderSlotBtn(grid, t); });
    var selBtn = section.querySelector('[data-action="slSelAll"]');
    var clrBtn = section.querySelector('[data-action="slClrAll"]');
    if (selBtn) selBtn.addEventListener('click', function() {
      var ts = _slGetTimes();
      times.forEach(function(t) { ts[_slTimeKey(cid, wkStart, di, t)] = true; });
      _slSaveTimes(ts);
      _slRefreshBtns(times, cid, wkStart, di);
      _updateCount();
    });
    if (clrBtn) clrBtn.addEventListener('click', function() {
      var ts = _slGetTimes();
      times.forEach(function(t) { ts[_slTimeKey(cid, wkStart, di, t)] = false; });
      _slSaveTimes(ts);
      _slRefreshBtns(times, cid, wkStart, di);
      _updateCount();
    });
    sectionsHost.appendChild(section);
  }
  if (showHalf === 'am') renderSection('First Half  ·  9:00 AM – 12:30 PM', _SL_AM);
  else if (showHalf === 'pm') renderSection('Second Half  ·  1:00 PM – 5:30 PM', _SL_PM);
  else {
    renderSection('First Half  ·  9:00 AM – 12:30 PM', _SL_AM);
    renderSection('Second Half  ·  1:00 PM – 5:30 PM', _SL_PM);
  }
  overlay.querySelector('[data-action="slCloseDrawer"]').addEventListener('click', _slCloseDrawer);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) _slCloseDrawer(); });
  overlay.querySelector('[data-action="slDrawerConfirm"]').addEventListener('click', function() { _slCloseDrawer(); admRSl(); });
  document.body.appendChild(overlay);
}

function _slRefreshBtns(times, cid, wkStart, di) {
  times.forEach(function(t) {
    var btn = document.getElementById('_slbtn_' + t.replace(':', ''));
    if (!btn) return;
    btn.classList.toggle('is-active', _slGetSlotActive(cid, wkStart, di, t));
  });
}

function _slRefreshBtnsAll(cid, wkStart, di) {
  _slRefreshBtns(_SL_ALL_TIMES, cid, wkStart, di);
}

function _slCloseDrawer() {
  var el = document.getElementById('_sl-drawer-overlay');
  if (el) el.remove();
}

// SAVE WEEK → localStorage + Supabase
function _slSaveWeek() {
  var cons    = _slActiveConsultants();
  var wkStart = _slWkStart(_slWkOff);
  var mon     = _slMon(_slWkOff);

  var newSlots = [];

  cons.forEach(function(c) {
    for (var di = 0; di < 7; di++) {
      var state = _slGetDayState(c.id, wkStart, di);
      if (state === 'leave' || state === 'none') continue;

      _SL_ALL_TIMES.forEach(function(t) {
        if (!_slGetSlotActive(c.id, wkStart, di, t)) return;
        var d = new Date(mon); d.setDate(d.getDate() + di);
        newSlots.push({
          id:             'SLT-' + c.id + '-' + wkStart + '-' + di + '-' + t.replace(':', ''),
          consultantId:   c.id,
          consultantName: c.name,
          date:           _slDateStr(d),
          time:           _slFmt(t),
          timeRaw:        t,
          dur:            30,
          status:         'available',
          addedAt:        new Date().toLocaleString('en-IN')
        });
      });
    }
  });

  iLogA('ok', 'Week slots saved', _slWeekLabel(_slWkOff) + ' — ' + newSlots.length + ' slots', 'Admin');

  if (!_slSbReady()) {
    if (typeof _whenReady === 'function') {
      _whenReady(function() { _slSaveWeek(); }, 'slSaveWeek');
      return;
    }
    intToast('warn', 'Could not save slots', 'Supabase is not ready', 'Admin');
    return;
  }

  intToast('info', 'Saving to database…', 'Please wait', 'Admin');
  _slSyncToSupabase(cons, wkStart, mon, newSlots);
}

// SUPABASE SYNC 
function _slClinicianEmail(c) {
  if (c.hcpEmail) return c.hcpEmail.toLowerCase().trim();
  var slug = (c.name || '').toLowerCase().replace(/dr\.\s*/i, '').replace(/\s+/g, '.').replace(/[^a-z.]/g, '');
  return slug + '@evaerahealth.in';
}

function _slClinicianRow(c) {
  return {
    id:             c.id,
    name:           c.name || '',
    qualification:  c.qual || '',
    specialisation: c.spec || '',
    hcp_email:      _slClinicianEmail(c),
    hcp_pass:       c.hcpPass || ('Eva' + Math.random().toString(36).slice(2, 6).toUpperCase() + '#' + Math.floor(10 + Math.random() * 90)),
    fee:            c.fee || 1500,
    experience:     c.exp || '',
    languages:      c.lang || 'Hindi, English',
    default_dur:    c.defaultDur || 30,
    active:         c.active !== false,
    added_at:       new Date().toISOString()
  };
}

function _slEnsureHcpClinicians(cons) {
  var SB = _slSbUrl();
  var apiHdrs = { apikey: _slSbKey(), Authorization: 'Bearer ' + _slSbKey() };
  var postHdrs = Object.assign({}, _slSbHeaders(), { Prefer: 'return=representation' });

  return fetch(SB + '/rest/v1/hcp_clinicians?select=id,hcp_email', { headers: apiHdrs })
    .then(function(res) { return res.json(); })
    .then(function(rows) {
      var byEmail = {};
      var byId = {};
      (rows || []).forEach(function(r) {
        if (r.hcp_email) byEmail[r.hcp_email.toLowerCase()] = r.id;
        if (r.id) byId[r.id] = true;
      });

      var idMap = {};
      var list = iLd(IK.cn, []);
      var listChanged = false;
      var tasks = [];

      cons.forEach(function(c) {
        var localId = c.id;
        if (byId[localId]) {
          idMap[localId] = localId;
          return;
        }
        var email = _slClinicianEmail(c);
        if (byEmail[email]) {
          idMap[localId] = byEmail[email];
          var stored = list.find(function(x) { return x.id === localId; });
          if (stored && stored.id !== byEmail[email] && stored.hcpEmail && stored.hcpEmail.toLowerCase() === email) {
            stored.id = byEmail[email];
            listChanged = true;
          }
          return;
        }
        tasks.push(
          fetch(SB + '/rest/v1/hcp_clinicians', {
            method: 'POST',
            headers: postHdrs,
            body: JSON.stringify(_slClinicianRow(c))
          }).then(function(res) {
            if (!res.ok) return res.text().then(function(t) { throw new Error('clinician sync: ' + t); });
            return res.json().then(function(inserted) {
              var dbId = inserted[0] && inserted[0].id;
              if (!dbId) throw new Error('clinician sync: no id returned');
              idMap[localId] = dbId;
              byId[dbId] = true;
              byEmail[email] = dbId;
              var stored = list.find(function(x) { return x.id === localId; });
              if (stored) {
                stored.id = dbId;
                stored.hcpEmail = email;
                listChanged = true;
              }
            });
          })
        );
      });

      return Promise.all(tasks).then(function() {
        if (listChanged) iSv(IK.cn, list);
        return idMap;
      });
    });
}

function _slPgEq(val) {
  return encodeURIComponent(String(val));
}

function _slDeleteWeekSlots(SB, consultantIds, wkStart, weekEndStr) {
  var hdrs = { apikey: _slSbKey(), Authorization: 'Bearer ' + _slSbKey() };
  return Promise.all(consultantIds.map(function(cid) {
    var url = SB + '/rest/v1/consultant_slots'
      + '?consultant_id=eq.' + _slPgEq(cid)
      + '&slot_date=gte.' + wkStart
      + '&slot_date=lte.' + weekEndStr;
    return fetch(url, { method: 'DELETE', headers: hdrs })
      .then(function(res) {
        if (!res.ok) return res.text().then(function(t) { throw new Error('delete slots (' + cid + '): ' + t); });
      });
  }));
}

function _slDedupeSlotRows(rows) {
  var seen = {};
  return rows.filter(function(r) {
    var k = r.consultant_id + '|' + r.slot_date + '|' + r.slot_time;
    if (seen[k]) return false;
    seen[k] = true;
    return true;
  });
}

function _slSyncToSupabase(cons, wkStart, mon, newSlots) {
  var SB            = _slSbUrl();
  var hdrs          = _slSbHeaders();
  var weekEnd       = new Date(mon); weekEnd.setDate(weekEnd.getDate() + 6);

  _slEnsureHcpClinicians(cons)
    .then(function(idMap) {
      var consultantIds = [];
      Object.keys(idMap).forEach(function(k) {
        if (consultantIds.indexOf(idMap[k]) < 0) consultantIds.push(idMap[k]);
        if (consultantIds.indexOf(k) < 0) consultantIds.push(k);
      });

      var slotRows = _slDedupeSlotRows(newSlots.map(function(s) {
        return {
          consultant_id: idMap[s.consultantId] || s.consultantId,
          slot_date:     s.date,
          slot_time:     s.timeRaw + ':00',
          is_active:     true
        };
      }));

      var weekEndStr = _slDateStr(weekEnd);

      return _slDeleteWeekSlots(SB, consultantIds, wkStart, weekEndStr)
      .then(function() {
        if (!slotRows.length) {
          intToast('success', 'Week saved', 'All slots cleared for this week', 'Admin');
          admRSl();
          return Promise.resolve();
        }
        var upsertHdrs = Object.assign({}, hdrs, {
          Prefer: 'return=minimal,resolution=merge-duplicates'
        });
        return fetch(SB + '/rest/v1/consultant_slots?on_conflict=consultant_id,slot_date,slot_time', {
          method:  'POST',
          headers: upsertHdrs,
          body:    JSON.stringify(slotRows)
        })
        .then(function(res) {
          if (!res.ok) return res.text().then(function(t) { throw new Error('slots upsert: ' + t); });
          intToast('success', 'Week saved to database', slotRows.length + ' slots synced', 'Admin');
          admRSl();
          if (typeof _admFetchSlotCounts === 'function' && typeof admRCon === 'function') {
            _admFetchSlotCounts(function(counts) { admRCon(_admConCache, counts); });
          }
        });
      });
    })
    .catch(function(err) {
      
      intToast('warn', 'Saved locally, Supabase sync failed', err.message, 'Admin');
      admRSl();
    });
}

// LOAD WEEK FROM SUPABASE 
function _slLoadWeekFromDb(offset) {
  if (!_slSbReady()) {
    if (typeof _whenReady === 'function') {
      _whenReady(function() { _slLoadWeekFromDb(offset); }, 'slLoadWeekFromDb');
      return;
    }
    admRSl();
    return;
  }

  var wkStart = _slWkStart(offset);
  var mon     = _slMon(offset);
  var weekEnd = new Date(mon); weekEnd.setDate(weekEnd.getDate() + 6);
  var SB      = _slSbUrl();

  fetch(SB + '/rest/v1/consultant_slots'
    + '?slot_date=gte.' + wkStart
    + '&slot_date=lte.' + _slDateStr(weekEnd)
    + '&is_active=eq.true'
    + '&select=consultant_id,slot_date,slot_time,is_active', {
    headers: { 'apikey': _slSbKey(), 'Authorization': 'Bearer ' + _slSbKey() }
  })
  .then(function(res) { return res.json(); })
  .then(function(slotRows) {
    var ts = _slGetTimes();
    slotRows.forEach(function(row) {
      var di  = _slDayOfWeek(row.slot_date);
      var t24 = row.slot_time.slice(0, 5);
      ts[_slTimeKey(row.consultant_id, wkStart, di, t24)] = row.is_active;
    });
    _slSaveTimes(ts);

    var cons = _slActiveConsultants();
    var av   = _slGetAvail();

    cons.forEach(function(c) {
      for (var di = 0; di < 7; di++) {
        var hasAM = _SL_AM.some(function(t) { return !!ts[_slTimeKey(c.id, wkStart, di, t)]; });
        var hasPM = _SL_PM.some(function(t) { return !!ts[_slTimeKey(c.id, wkStart, di, t)]; });
        var inferredState;
        if (hasAM && hasPM)       inferredState = 'full';
        else if (hasAM && !hasPM) inferredState = 'am';
        else if (!hasAM && hasPM) inferredState = 'pm';
        else {
          var existing = av[_slAvailKey(c.id, wkStart, di)];
          inferredState = (existing === 'leave') ? 'leave' : 'none';
        }
        av[_slAvailKey(c.id, wkStart, di)] = inferredState;
      }
    });
    _slSaveAvail(av);
    admRSl();
  })
  .catch(function(err) {
    
    admRSl();
  });
}

// BOOKING FLOW 
function slFetchSlotsForConsultant(conId, callback) {
  if (!_slSbReady()) {
    if (typeof _whenReady === 'function') {
      _whenReady(function() { slFetchSlotsForConsultant(conId, callback); }, 'slFetchSlotsForConsultant');
      return;
    }
    
    callback([]);
    return;
  }

  var today = _slDateStr(new Date());
  var SB    = _slSbUrl();

  fetch(SB + '/rest/v1/consultant_slots'
    + '?consultant_id=eq.' + encodeURIComponent(conId)
    + '&slot_date=gte.'    + today
    + '&booked_appointment_id=is.null'
    + '&is_active=eq.true'
    + '&order=slot_date.asc,slot_time.asc'
    + '&select=id,consultant_id,slot_date,slot_time', {
    headers: { 'apikey': _slSbKey(), 'Authorization': 'Bearer ' + _slSbKey() }
  })
  .then(function(res) {
    if (!res.ok) return res.text().then(function(t) { throw new Error(t); });
    return res.json();
  })
  .then(function(rows) {
    if (!rows || !rows.length) { callback([]); return; }
    var con = _slFindConsultant(conId);
    var slots = rows.map(function(r) {
      return {
        id:             r.id,
        consultantId:   r.consultant_id,
        consultantName: con ? con.name : '',
        date:           r.slot_date,
        time:           _slFmt(r.slot_time.slice(0, 5)),
        timeRaw:        r.slot_time.slice(0, 5),
        dur:            30,
        status:         'available',
        source:         'supabase'
      };
    });
    callback(slots);
  })
  .catch(function(err) {
    
    callback([]);
  });
}

// MARK SLOT BOOKED 
function slMarkSlotBooked(slotId, appointmentId) {
  if (!_slSbReady() || !slotId || String(slotId).startsWith('SLT-')) return;

  fetch(_slSbUrl() + '/rest/v1/consultant_slots?id=eq.' + slotId, {
    method:  'PATCH',
    headers: _slSbHeaders(),
    body:    JSON.stringify({ booked_appointment_id: appointmentId })
  })
  .then(function(res) {
    if (!res.ok) return res.text().then(function(t) { throw new Error(t); });
    
  })
  .catch(function(err) {  });
}
                                                                                                                                                                                    
// STUBS
function admOSl() { intToast('info', 'Use the weekly grid to manage slots', '', 'Admin'); }
function admASl() {}
function admFSF() {}

