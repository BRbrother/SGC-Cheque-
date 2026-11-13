/**
 * SGC Cheque Manager - Application Controller & UI Engine
 * Shekhawat Groups of Companies | Offline-First Android PWA
 */

(() => {
  'use strict';

  const state = {
    companies: [],
    accounts: [],
    cheques: [],
    activeView: 'dashboard',
    editingChequeId: null
  };

  // --- Security & Formatting Utilities ---
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function maskAccountNumber(acctNum) {
    const clean = String(acctNum || '').trim();
    if (!clean) return 'Not Provided';
    if (clean.length <= 4) return 'XXXX';
    const last4 = clean.slice(-4);
    return 'X'.repeat(Math.min(8, clean.length - 4)) + last4;
  }

  function formatINR(amount) {
    const num = Number(amount) || 0;
    return num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function formatDateDisplay(isoDate) {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  function formatChequeLeafDate(isoDate) {
    if (!isoDate) return 'DDMMYYYY';
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    return `${parts[2]}${parts[1]}${parts[0]}`;
  }

  // Indian English Number-to-Words Converter (Crores, Lakhs, Thousands, Hundreds, Paise)
  function numberToIndianWords(amount) {
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      return 'Zero Rupees Only';
    }

    const ones = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
      'Seventeen', 'Eighteen', 'Nineteen'
    ];
    const tens = [
      '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
    ];

    function twoDigits(n) {
      if (n === 0) return '';
      if (n < 20) return ones[n];
      const t = Math.floor(n / 10);
      const o = n % 10;
      return tens[t] + (o ? ' ' + ones[o] : '');
    }

    function threeDigits(n) {
      if (n === 0) return '';
      const h = Math.floor(n / 100);
      const rem = n % 100;
      let str = '';
      if (h > 0) str += ones[h] + ' Hundred';
      if (rem > 0) str += (str ? ' ' : '') + twoDigits(rem);
      return str;
    }

    const whole = Math.floor(num);
    const paise = Math.round((num - whole) * 100);

    let words = '';
    let n = whole;

    if (n >= 10000000) {
      const crores = Math.floor(n / 10000000);
      words += numberChunkIndian(crores) + ' Crore ';
      n %= 10000000;
    }
    if (n >= 100000) {
      const lakhs = Math.floor(n / 100000);
      words += twoDigits(lakhs) + ' Lakh ';
      n %= 100000;
    }
    if (n >= 1000) {
      const thousands = Math.floor(n / 1000);
      words += twoDigits(thousands) + ' Thousand ';
      n %= 1000;
    }
    if (n > 0) {
      words += threeDigits(n);
    }

    function numberChunkIndian(val) {
      if (val < 100) return twoDigits(val);
      if (val < 1000) return threeDigits(val);
      const th = Math.floor(val / 1000);
      const rem = val % 1000;
      return twoDigits(th) + ' Thousand' + (rem ? ' ' + threeDigits(rem) : '');
    }

    words = words.trim();
    let result = words ? `${words} Rupees` : '';
    if (paise > 0) {
      result += (result ? ' and ' : '') + `${twoDigits(paise)} Paise`;
    }
    return (result || 'Zero Rupees') + ' Only';
  }

  // --- UI Notifications & Confirmation Modal ---
  function showToast(message, isError = false) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast' + (isError ? ' toast-error' : '');
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3400);
  }

  function showConfirm(title, message, confirmLabel = 'Confirm', isDanger = false) {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirm-modal');
      const titleEl = document.getElementById('modal-title');
      const msgEl = document.getElementById('modal-message');
      const confirmBtn = document.getElementById('modal-confirm-btn');
      const cancelBtn = document.getElementById('modal-cancel-btn');

      titleEl.textContent = title;
      msgEl.textContent = message;
      confirmBtn.textContent = confirmLabel;
      confirmBtn.className = isDanger ? 'btn btn-danger' : 'btn btn-primary';

      modal.classList.remove('hidden');

      function cleanup(result) {
        modal.classList.add('hidden');
        confirmBtn.removeEventListener('click', onConfirm);
        cancelBtn.removeEventListener('click', onCancel);
        resolve(result);
      }

      function onConfirm() { cleanup(true); }
      function onCancel() { cleanup(false); }

      confirmBtn.addEventListener('click', onConfirm);
      cancelBtn.addEventListener('click', onCancel);
    });
  }

  // --- Navigation ---
  function switchView(viewId) {
    state.activeView = viewId;
    document.querySelectorAll('.view-section').forEach((sec) => {
      sec.classList.toggle('active', sec.id === `view-${viewId}`);
    });
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === viewId);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- Data Loading & Rendering ---
  async function refreshAllData() {
    const [companies, accounts, cheques, lastBackup] = await Promise.all([
      SGC_DB.getCompanies(),
      SGC_DB.getAccounts(),
      SGC_DB.getCheques(),
      SGC_DB.getMeta('lastBackupAt')
    ]);
    state.companies = companies;
    state.accounts = accounts;
    state.cheques = cheques;

    renderDashboard();
    renderCompaniesList();
    renderAccountsList();
    populateSelectDropdowns();
    renderRegister();
    updateBackupStatusUI(lastBackup, cheques.length);
    updateChequePreview();
  }

  function getCompanyById(id) {
    return state.companies.find((c) => c.id === id) || null;
  }

  function getAccountById(id) {
    return state.accounts.find((a) => a.id === id) || null;
  }

  // --- Dashboard ---
  function renderDashboard() {
    const totalCompanies = state.companies.length;
    const totalAccounts = state.accounts.length;
    const totalCheques = state.cheques.length;

    const draftCheques = state.cheques.filter((c) => c.status === 'Draft');
    const issuedCheques = state.cheques.filter((c) => c.status === 'Issued');
    const clearedCheques = state.cheques.filter((c) => c.status === 'Cleared');

    const sumAmount = (arr) => arr.reduce((acc, c) => acc + (Number(c.amount) || 0), 0);

    document.getElementById('kpi-companies').textContent = totalCompanies;
    document.getElementById('kpi-accounts').textContent = totalAccounts;
    document.getElementById('kpi-total-cheques').textContent = totalCheques;
    document.getElementById('kpi-total-amount').textContent = `INR ${formatINR(sumAmount(state.cheques))}`;

    document.getElementById('kpi-pending-cheques').textContent = draftCheques.length;
    document.getElementById('kpi-pending-amount').textContent = `INR ${formatINR(sumAmount(draftCheques))}`;

    document.getElementById('kpi-issued-cheques').textContent = issuedCheques.length;
    document.getElementById('kpi-issued-amount').textContent = `INR ${formatINR(sumAmount(issuedCheques))}`;

    document.getElementById('kpi-cleared-cheques').textContent = clearedCheques.length;
    document.getElementById('kpi-cleared-amount').textContent = `INR ${formatINR(sumAmount(clearedCheques))}`;

    const recentContainer = document.getElementById('dashboard-recent-list');
    const recent = state.cheques.slice(0, 6);

    if (recent.length === 0) {
      recentContainer.innerHTML = '<div class="empty-state">No cheque records yet. Start by adding a company and bank account.</div>';
      return;
    }

    recentContainer.innerHTML = recent.map((chq) => {
      const comp = getCompanyById(chq.companyId);
      const acct = getAccountById(chq.accountId);
      return `
        <div class="record-card">
          <div class="record-top">
            <div>
              <div class="record-title">${escapeHtml(chq.payeeName)}</div>
              <div class="record-meta">
                <span>Cheque #<strong>${escapeHtml(chq.chequeNumber)}</strong></span>
                <span>${escapeHtml(formatDateDisplay(chq.chequeDate))}</span>
                <span class="status-badge status-${escapeHtml(chq.status)}">${escapeHtml(chq.status)}</span>
              </div>
            </div>
            <div class="record-amount">&#8377; ${escapeHtml(formatINR(chq.amount))}</div>
          </div>
          <div class="record-meta">
            <span>${escapeHtml(comp ? comp.name : 'Unknown Company')}</span>
            <span>&bull; ${escapeHtml(acct ? acct.bankName : 'Unknown Bank')} (${escapeHtml(maskAccountNumber(acct?.accountNumber))})</span>
          </div>
          <div class="record-actions">
            <button type="button" class="btn btn-outline btn-sm" data-action="edit-cheque" data-id="${escapeHtml(chq.id)}">Open / Print</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // --- Companies ---
  function renderCompaniesList() {
    document.getElementById('companies-count').textContent = state.companies.length;
    const container = document.getElementById('companies-list');

    if (state.companies.length === 0) {
      container.innerHTML = '<div class="empty-state">No companies added yet. Add your first Shekhawat Group entity above.</div>';
      return;
    }

    container.innerHTML = state.companies.map((comp) => {
      const acctCount = state.accounts.filter((a) => a.companyId === comp.id).length;
      return `
        <div class="record-card">
          <div class="record-top">
            <div>
              <div class="record-title">${escapeHtml(comp.name)}</div>
              <div class="record-meta">
                <span>${acctCount} Bank Account${acctCount === 1 ? '' : 's'}</span>
                ${comp.phone ? `<span>&bull; ${escapeHtml(comp.phone)}</span>` : ''}
                ${comp.email ? `<span>&bull; ${escapeHtml(comp.email)}</span>` : ''}
              </div>
            </div>
          </div>
          ${comp.address ? `<div class="record-meta">${escapeHtml(comp.address)}</div>` : ''}
          <div class="record-actions">
            <button type="button" class="btn btn-outline btn-sm" data-action="edit-company" data-id="${escapeHtml(comp.id)}">Edit</button>
            <button type="button" class="btn btn-danger btn-sm" data-action="delete-company" data-id="${escapeHtml(comp.id)}">Delete</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function resetCompanyForm() {
    document.getElementById('comp-id').value = '';
    document.getElementById('comp-name').value = '';
    document.getElementById('comp-address').value = '';
    document.getElementById('comp-phone').value = '';
    document.getElementById('comp-email').value = '';
    document.getElementById('company-form-title').textContent = 'Add New Company';
    document.getElementById('btn-cancel-company').classList.add('hidden');
  }

  // --- Bank Accounts ---
  function renderAccountsList() {
    document.getElementById('accounts-count').textContent = state.accounts.length;
    const container = document.getElementById('accounts-list');

    if (state.accounts.length === 0) {
      container.innerHTML = '<div class="empty-state">No bank accounts configured yet.</div>';
      return;
    }

    container.innerHTML = state.accounts.map((acct) => {
      const comp = getCompanyById(acct.companyId);
      return `
        <div class="record-card">
          <div class="record-top">
            <div>
              <div class="record-title">${escapeHtml(acct.bankName)} &mdash; ${escapeHtml(acct.branchName)}</div>
              <div class="record-meta">
                <span><strong>${escapeHtml(comp ? comp.name : 'Unassigned Company')}</strong></span>
                <span>&bull; Holder: ${escapeHtml(acct.holderName)}</span>
              </div>
            </div>
          </div>
          <div class="record-meta">
            <span>A/C: <strong>${escapeHtml(maskAccountNumber(acct.accountNumber))}</strong></span>
            ${acct.ifscCode ? `<span>&bull; IFSC: ${escapeHtml(acct.ifscCode)}</span>` : ''}
          </div>
          ${acct.printingNotes ? `<div class="record-meta">Notes: ${escapeHtml(acct.printingNotes)}</div>` : ''}
          <div class="record-actions">
            <button type="button" class="btn btn-outline btn-sm" data-action="edit-account" data-id="${escapeHtml(acct.id)}">Edit</button>
            <button type="button" class="btn btn-primary btn-sm" data-action="calibrate-account" data-id="${escapeHtml(acct.id)}">Print Calibration</button>
            <button type="button" class="btn btn-danger btn-sm" data-action="delete-account" data-id="${escapeHtml(acct.id)}">Delete</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function resetAccountForm() {
    document.getElementById('acct-id').value = '';
    document.getElementById('acct-company').value = '';
    document.getElementById('acct-bank').value = '';
    document.getElementById('acct-branch').value = '';
    document.getElementById('acct-holder').value = '';
    document.getElementById('acct-number').value = '';
    document.getElementById('acct-ifsc').value = '';
    document.getElementById('acct-notes').value = '';
    document.getElementById('account-form-title').textContent = 'Add Bank Account';
    document.getElementById('btn-cancel-account').classList.add('hidden');
  }

  // --- Dropdown Synchronization ---
  function populateSelectDropdowns() {
    const companyOptions = state.companies
      .map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`)
      .join('');

    const acctCompanySel = document.getElementById('acct-company');
    const prevAcctComp = acctCompanySel.value;
    acctCompanySel.innerHTML = `<option value="">-- Select Company --</option>${companyOptions}`;
    if (prevAcctComp) acctCompanySel.value = prevAcctComp;

    const chqCompanySel = document.getElementById('chq-company');
    const prevChqComp = chqCompanySel.value;
    chqCompanySel.innerHTML = `<option value="">-- Choose Company --</option>${companyOptions}`;
    if (prevChqComp && getCompanyById(prevChqComp)) {
      chqCompanySel.value = prevChqComp;
    } else if (state.companies.length === 1) {
      chqCompanySel.value = state.companies[0].id;
    }
    populateChequeAccountsDropdown(chqCompanySel.value);

    // Register Filter Dropdowns
    const regCompSel = document.getElementById('reg-filter-company');
    const prevRegComp = regCompSel.value;
    regCompSel.innerHTML = `<option value="">All Companies</option>${companyOptions}`;
    if (prevRegComp) regCompSel.value = prevRegComp;

    const regAcctSel = document.getElementById('reg-filter-account');
    const prevRegAcct = regAcctSel.value;
    const allAcctOptions = state.accounts
      .map((a) => {
        const comp = getCompanyById(a.companyId);
        return `<option value="${escapeHtml(a.id)}">${escapeHtml(a.bankName)} (${escapeHtml(maskAccountNumber(a.accountNumber))}) - ${escapeHtml(comp ? comp.name : '')}</option>`;
      })
      .join('');
    regAcctSel.innerHTML = `<option value="">All Bank Accounts</option>${allAcctOptions}`;
    if (prevRegAcct) regAcctSel.value = prevRegAcct;

    // Setup alert banner on Cheque form
    const prereqAlert = document.getElementById('cheque-prereq-alert');
    if (state.companies.length === 0 || state.accounts.length === 0) {
      prereqAlert.classList.remove('hidden');
    } else {
      prereqAlert.classList.add('hidden');
    }
  }

  function populateChequeAccountsDropdown(companyId, selectedAccountId = null) {
    const chqAcctSel = document.getElementById('chq-account');
    const prevVal = selectedAccountId || chqAcctSel.value;
    const filtered = companyId
      ? state.accounts.filter((a) => a.companyId === companyId)
      : state.accounts;

    const options = filtered
      .map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.bankName)} - ${escapeHtml(a.branchName)} (${escapeHtml(maskAccountNumber(a.accountNumber))})</option>`)
      .join('');

    chqAcctSel.innerHTML = `<option value="">-- Choose Bank Account --</option>${options}`;
    if (prevVal && filtered.some((a) => a.id === prevVal)) {
      chqAcctSel.value = prevVal;
    } else if (filtered.length === 1) {
      chqAcctSel.value = filtered[0].id;
    }
    onChequeAccountChange();
  }

  function onChequeAccountChange() {
    const acctId = document.getElementById('chq-account').value;
    const acct = getAccountById(acctId);
    const hintEl = document.getElementById('chq-account-hint');
    const calLabel = document.getElementById('calibration-account-label');

    if (acct) {
      hintEl.textContent = `Holder: ${acct.holderName}${acct.printingNotes ? ' | Note: ' + acct.printingNotes : ''}`;
      calLabel.textContent = `${acct.bankName} (${maskAccountNumber(acct.accountNumber)})`;
      loadCalibrationInputs(acct.printConfig || SGC_DB.DEFAULT_PRINT_CONFIG);
    } else {
      hintEl.textContent = '';
      calLabel.textContent = 'Default Layout (Select Account)';
      loadCalibrationInputs(SGC_DB.DEFAULT_PRINT_CONFIG);
    }
    updateChequePreview();
  }

  // --- Cheque Preparation & Calibration ---
  function resetChequeForm() {
    state.editingChequeId = null;
    document.getElementById('chq-id').value = '';
    document.getElementById('cheque-form-heading').textContent = 'Cheque Preparation';
    document.getElementById('btn-save-cheque').textContent = 'Save Cheque Record';
    document.getElementById('chq-number').value = '';
    document.getElementById('chq-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('chq-payee').value = '';
    document.getElementById('chq-amount').value = '';
    document.getElementById('chq-status').value = 'Draft';
    document.getElementById('chq-ac-payee').checked = true;
    document.getElementById('chq-remarks').value = '';
    document.getElementById('chq-amount-words-box').textContent = 'Zero Rupees Only';
    updateChequePreview();
  }

  function loadCalibrationInputs(cfg) {
    const c = { ...SGC_DB.DEFAULT_PRINT_CONFIG, ...(cfg || {}) };
    document.getElementById('cal-font-size').value = c.fontSizePt;
    document.getElementById('cal-print-scale').value = c.printScale;
    document.getElementById('cal-date-spacing').value = c.dateLetterSpacing;
    document.getElementById('cal-date-x').value = c.dateX;
    document.getElementById('cal-date-y').value = c.dateY;
    document.getElementById('cal-payee-x').value = c.payeeX;
    document.getElementById('cal-payee-y').value = c.payeeY;
    document.getElementById('cal-words-x').value = c.wordsX;
    document.getElementById('cal-words-y').value = c.wordsY;
    document.getElementById('cal-words-w').value = c.wordsWidth;
    document.getElementById('cal-amount-x').value = c.amountX;
    document.getElementById('cal-amount-y').value = c.amountY;
    document.getElementById('cal-ac-x').value = c.acPayeeX;
    document.getElementById('cal-ac-y').value = c.acPayeeY;
  }

  function readCalibrationInputs() {
    return {
      fontSizePt: parseFloat(document.getElementById('cal-font-size').value) || 11,
      printScale: parseFloat(document.getElementById('cal-print-scale').value) || 1.0,
      dateLetterSpacing: parseFloat(document.getElementById('cal-date-spacing').value) || 3.2,
      dateX: parseFloat(document.getElementById('cal-date-x').value) || 152,
      dateY: parseFloat(document.getElementById('cal-date-y').value) || 9,
      payeeX: parseFloat(document.getElementById('cal-payee-x').value) || 24,
      payeeY: parseFloat(document.getElementById('cal-payee-y').value) || 23,
      wordsX: parseFloat(document.getElementById('cal-words-x').value) || 30,
      wordsY: parseFloat(document.getElementById('cal-words-y').value) || 33,
      wordsWidth: parseFloat(document.getElementById('cal-words-w').value) || 115,
      amountX: parseFloat(document.getElementById('cal-amount-x').value) || 156,
      amountY: parseFloat(document.getElementById('cal-amount-y').value) || 42,
      acPayeeX: parseFloat(document.getElementById('cal-ac-x').value) || 14,
      acPayeeY: parseFloat(document.getElementById('cal-ac-y').value) || 12
    };
  }

  function updateChequePreview() {
    const cfg = readCalibrationInputs();
    const leaf = document.getElementById('cheque-preview-leaf');
    const dateVal = document.getElementById('chq-date').value;
    const payeeVal = document.getElementById('chq-payee').value.trim() || 'Payee Name';
    const amountVal = parseFloat(document.getElementById('chq-amount').value) || 0;
    const acPayee = document.getElementById('chq-ac-payee').checked;
    const wordsVal = numberToIndianWords(amountVal);

    document.getElementById('chq-amount-words-box').textContent = wordsVal;

    leaf.style.fontSize = `${cfg.fontSizePt}pt`;
    leaf.style.transform = `scale(${cfg.printScale})`;

    const elAc = document.getElementById('prev-ac-payee');
    elAc.style.display = acPayee ? 'block' : 'none';
    elAc.style.left = `${cfg.acPayeeX}mm`;
    elAc.style.top = `${cfg.acPayeeY}mm`;

    const elDate = document.getElementById('prev-date');
    elDate.textContent = formatChequeLeafDate(dateVal);
    elDate.style.left = `${cfg.dateX}mm`;
    elDate.style.top = `${cfg.dateY}mm`;
    elDate.style.letterSpacing = `${cfg.dateLetterSpacing}mm`;

    const elPayee = document.getElementById('prev-payee');
    elPayee.textContent = payeeVal;
    elPayee.style.left = `${cfg.payeeX}mm`;
    elPayee.style.top = `${cfg.payeeY}mm`;

    const elWords = document.getElementById('prev-words');
    elWords.textContent = wordsVal;
    elWords.style.left = `${cfg.wordsX}mm`;
    elWords.style.top = `${cfg.wordsY}mm`;
    elWords.style.width = `${cfg.wordsWidth}mm`;

    const elAmount = document.getElementById('prev-amount');
    elAmount.textContent = `**${formatINR(amountVal)}/-**`;
    elAmount.style.left = `${cfg.amountX}mm`;
    elAmount.style.top = `${cfg.amountY}mm`;
  }

  function triggerChequePrint(isPlainPaperTest) {
    const payeeVal = document.getElementById('chq-payee').value.trim();
    const amountVal = parseFloat(document.getElementById('chq-amount').value) || 0;
    const dateVal = document.getElementById('chq-date').value;

    if (!payeeVal || amountVal <= 0 || !dateVal) {
      showToast('Enter Date, Payee Name, and a valid Amount before printing.', true);
      return;
    }

    const cfg = readCalibrationInputs();
    const acPayee = document.getElementById('chq-ac-payee').checked;
    const wordsVal = numberToIndianWords(amountVal);
    const printContainer = document.getElementById('print-output-container');

    printContainer.innerHTML = `
      <div class="print-cheque-sheet ${isPlainPaperTest ? 'is-plain-test' : ''}" style="font-size:${cfg.fontSizePt}pt; transform:scale(${cfg.printScale}); transform-origin:top left;">
        ${isPlainPaperTest ? '<div class="print-test-banner">SGC CHEQUE MANAGER - PLAIN PAPER ALIGNMENT TEST (NO MICR / NO LOGO)</div>' : ''}
        ${acPayee ? `<div class="leaf-field leaf-ac-payee" style="left:${cfg.acPayeeX}mm; top:${cfg.acPayeeY}mm;">A/C PAYEE ONLY</div>` : ''}
        <div class="leaf-field" style="left:${cfg.dateX}mm; top:${cfg.dateY}mm; letter-spacing:${cfg.dateLetterSpacing}mm;">${escapeHtml(formatChequeLeafDate(dateVal))}</div>
        <div class="leaf-field" style="left:${cfg.payeeX}mm; top:${cfg.payeeY}mm;">${escapeHtml(payeeVal)}</div>
        <div class="leaf-field leaf-words" style="left:${cfg.wordsX}mm; top:${cfg.wordsY}mm; width:${cfg.wordsWidth}mm;">${escapeHtml(wordsVal)}</div>
        <div class="leaf-field" style="left:${cfg.amountX}mm; top:${cfg.amountY}mm;">**${escapeHtml(formatINR(amountVal))}/-**</div>
        ${isPlainPaperTest ? '<div class="print-sign-box">Signature Area (Left Blank)</div>' : ''}
      </div>
    `;

    window.print();
  }

  // --- Cheque Register ---
  function getFilteredCheques() {
    const query = document.getElementById('reg-search').value.trim().toLowerCase();
    const compFilter = document.getElementById('reg-filter-company').value;
    const acctFilter = document.getElementById('reg-filter-account').value;
    const statusFilter = document.getElementById('reg-filter-status').value;
    const dateFrom = document.getElementById('reg-date-from').value;
    const dateTo = document.getElementById('reg-date-to').value;

    return state.cheques.filter((c) => {
      if (compFilter && c.companyId !== compFilter) return false;
      if (acctFilter && c.accountId !== acctFilter) return false;
      if (statusFilter && c.status !== statusFilter) return false;
      if (dateFrom && c.chequeDate < dateFrom) return false;
      if (dateTo && c.chequeDate > dateTo) return false;
      if (query) {
        const hay = `${c.chequeNumber} ${c.payeeName} ${c.remarks || ''} ${c.status}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }

  function renderRegister() {
    const filtered = getFilteredCheques();
    const totalSum = filtered.reduce((acc, c) => acc + (Number(c.amount) || 0), 0);

    document.getElementById('register-summary-text').textContent =
      `Showing ${filtered.length} cheque${filtered.length === 1 ? '' : 's'} • Total: INR ${formatINR(totalSum)}`;

    const container = document.getElementById('register-list-container');
    if (filtered.length === 0) {
      container.innerHTML = '<div class="card empty-state">No cheques match the selected criteria.</div>';
      return;
    }

    container.innerHTML = filtered.map((chq) => {
      const comp = getCompanyById(chq.companyId);
      const acct = getAccountById(chq.accountId);
      return `
        <div class="record-card">
          <div class="record-top">
            <div>
              <div class="record-title">#${escapeHtml(chq.chequeNumber)} &mdash; ${escapeHtml(chq.payeeName)}</div>
              <div class="record-meta">
                <span>Date: <strong>${escapeHtml(formatDateDisplay(chq.chequeDate))}</strong></span>
                <span class="status-badge status-${escapeHtml(chq.status)}">${escapeHtml(chq.status)}</span>
                ${chq.acPayee ? '<span>&bull; A/C Payee</span>' : ''}
              </div>
            </div>
            <div class="record-amount">&#8377; ${escapeHtml(formatINR(chq.amount))}</div>
          </div>
          <div class="record-meta">
            <span>Company: <strong>${escapeHtml(comp ? comp.name : 'Unknown')}</strong></span>
            <span>&bull; Bank: ${escapeHtml(acct ? acct.bankName : 'Unknown')} (${escapeHtml(maskAccountNumber(acct?.accountNumber))})</span>
          </div>
          ${chq.remarks ? `<div class="record-meta">Remarks: ${escapeHtml(chq.remarks)}</div>` : ''}
          <div class="record-actions">
            <button type="button" class="btn btn-outline btn-sm" data-action="edit-cheque" data-id="${escapeHtml(chq.id)}">Edit / Print</button>
            <button type="button" class="btn btn-danger btn-sm" data-action="delete-cheque" data-id="${escapeHtml(chq.id)}">Delete</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function exportRegisterCSV() {
    const filtered = getFilteredCheques();
    if (filtered.length === 0) {
      showToast('No filtered cheques available to export.', true);
      return;
    }

    const headers = [
      'Cheque Number',
      'Cheque Date',
      'Company',
      'Bank Name',
      'Account (Masked)',
      'Payee Name',
      'Amount (INR)',
      'Amount in Words',
      'A/C Payee',
      'Status',
      'Remarks'
    ];

    const csvEscape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const rows = filtered.map((c) => {
      const comp = getCompanyById(c.companyId);
      const acct = getAccountById(c.accountId);
      return [
        c.chequeNumber,
        c.chequeDate,
        comp ? comp.name : '',
        acct ? acct.bankName : '',
        maskAccountNumber(acct?.accountNumber),
        c.payeeName,
        Number(c.amount).toFixed(2),
        c.amountWords,
        c.acPayee ? 'Yes' : 'No',
        c.status,
        c.remarks || ''
      ].map(csvEscape).join(',');
    });

    const csvString = '﻿' + [headers.map(csvEscape).join(','), ...rows].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SGC-Cheque-Register-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Cheque Register CSV exported.');
  }

  function printRegisterReport() {
    const filtered = getFilteredCheques();
    if (filtered.length === 0) {
      showToast('No filtered cheques available to print.', true);
      return;
    }

    const totalSum = filtered.reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
    const printContainer = document.getElementById('print-output-container');

    const rowsHtml = filtered.map((c) => {
      const comp = getCompanyById(c.companyId);
      const acct = getAccountById(c.accountId);
      return `
        <tr>
          <td>${escapeHtml(c.chequeNumber)}</td>
          <td>${escapeHtml(formatDateDisplay(c.chequeDate))}</td>
          <td>${escapeHtml(comp ? comp.name : '')}</td>
          <td>${escapeHtml(acct ? acct.bankName : '')} (${escapeHtml(maskAccountNumber(acct?.accountNumber))})</td>
          <td>${escapeHtml(c.payeeName)}</td>
          <td style="text-align:right;">${escapeHtml(formatINR(c.amount))}</td>
          <td>${escapeHtml(c.status)}</td>
          <td>${escapeHtml(c.remarks || '')}</td>
        </tr>
      `;
    }).join('');

    printContainer.innerHTML = `
      <div class="register-print-doc">
        <h1>SHEKHAWAT GROUPS OF COMPANIES &mdash; CHEQUE REGISTER</h1>
        <div>Generated by SGC Cheque Manager on ${escapeHtml(new Date().toLocaleString('en-IN'))} | Records: ${filtered.length} | Total Amount: INR ${escapeHtml(formatINR(totalSum))}</div>
        <table>
          <thead>
            <tr>
              <th>Cheque #</th>
              <th>Date</th>
              <th>Company</th>
              <th>Bank Account</th>
              <th>Payee</th>
              <th style="text-align:right;">Amount (INR)</th>
              <th>Status</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;

    window.print();
  }

  // --- Backup & Reminder ---
  function updateBackupStatusUI(lastBackupIso, chequeCount) {
    const tsEl = document.getElementById('last-backup-timestamp');
    const banner = document.getElementById('backup-reminder-banner');
    const bannerText = document.getElementById('backup-reminder-text');

    if (lastBackupIso) {
      const d = new Date(lastBackupIso);
      tsEl.textContent = d.toLocaleString('en-IN');
      const daysSince = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince >= 7 && chequeCount > 0) {
        bannerText.textContent = `Last backup was ${Math.floor(daysSince)} days ago. Export a fresh JSON backup.`;
        banner.classList.remove('hidden');
      } else {
        banner.classList.add('hidden');
      }
    } else {
      tsEl.textContent = 'Never backed up';
      if (chequeCount > 0) {
        bannerText.textContent = 'Backup Reminder: You have unsaved local records with no backup yet.';
        banner.classList.remove('hidden');
      } else {
        banner.classList.add('hidden');
      }
    }
  }

  async function handleExportJSONBackup() {
    try {
      const payload = await SGC_DB.exportAllData();
      const jsonStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `SGC-Cheque-Manager-Backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      await refreshAllData();
      showToast('Complete JSON backup downloaded to device.');
    } catch (err) {
      showToast(err.message || 'Backup failed.', true);
    }
  }

  // --- Offline Network Indicator & Service Worker Registration ---
  function initNetworkIndicator() {
    const badge = document.getElementById('network-status-badge');
    const text = document.getElementById('network-status-text');

    function updateStatus() {
      if (navigator.onLine) {
        badge.classList.remove('is-offline');
        text.textContent = 'Offline Ready';
      } else {
        badge.classList.add('is-offline');
        text.textContent = 'Offline Mode';
      }
    }

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.warn('Service worker registration note:', err);
      });
    }
  }

  // --- Event Binding ---
  function bindEvents() {
    // Bottom Navigation & Quick Goto Buttons
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    document.querySelectorAll('[data-goto]').forEach((btn) => {
      btn.addEventListener('click', () => switchView(btn.dataset.goto));
    });

    // Banner Backup & Dismiss
    document.getElementById('banner-backup-btn').addEventListener('click', handleExportJSONBackup);
    document.getElementById('banner-dismiss-btn').addEventListener('click', () => {
      document.getElementById('backup-reminder-banner').classList.add('hidden');
    });

    // Company Form Submit
    document.getElementById('company-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const id = document.getElementById('comp-id').value;
        const name = document.getElementById('comp-name').value;
        const address = document.getElementById('comp-address').value;
        const phone = document.getElementById('comp-phone').value;
        const email = document.getElementById('comp-email').value;

        await SGC_DB.saveCompany({ id: id || undefined, name, address, phone, email });
        resetCompanyForm();
        await refreshAllData();
        showToast(id ? 'Company updated successfully.' : 'Company registered successfully.');
      } catch (err) {
        showToast(err.message, true);
      }
    });

    document.getElementById('btn-cancel-company').addEventListener('click', resetCompanyForm);

    // Account Form Submit
    document.getElementById('account-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const id = document.getElementById('acct-id').value;
        const payload = {
          id: id || undefined,
          companyId: document.getElementById('acct-company').value,
          bankName: document.getElementById('acct-bank').value,
          branchName: document.getElementById('acct-branch').value,
          holderName: document.getElementById('acct-holder').value,
          accountNumber: document.getElementById('acct-number').value,
          ifscCode: document.getElementById('acct-ifsc').value,
          printingNotes: document.getElementById('acct-notes').value
        };
        await SGC_DB.saveAccount(payload);
        resetAccountForm();
        await refreshAllData();
        showToast(id ? 'Bank account updated.' : 'Bank account added.');
      } catch (err) {
        showToast(err.message, true);
      }
    });

    document.getElementById('btn-cancel-account').addEventListener('click', resetAccountForm);

    // Cheque Form Cascading & Live Preview
    document.getElementById('chq-company').addEventListener('change', (e) => {
      populateChequeAccountsDropdown(e.target.value);
    });

    document.getElementById('chq-account').addEventListener('change', onChequeAccountChange);

    ['chq-date', 'chq-payee', 'chq-amount', 'chq-ac-payee'].forEach((id) => {
      document.getElementById(id).addEventListener('input', updateChequePreview);
      document.getElementById(id).addEventListener('change', updateChequePreview);
    });

    document.querySelectorAll('#print-studio-card input').forEach((inp) => {
      inp.addEventListener('input', updateChequePreview);
    });

    document.getElementById('btn-reset-cheque-form').addEventListener('click', resetChequeForm);

    document.getElementById('btn-open-print-studio').addEventListener('click', () => {
      updateChequePreview();
      document.getElementById('print-studio-card').scrollIntoView({ behavior: 'smooth' });
    });

    // Save Cheque with Confirmation
    document.getElementById('cheque-entry-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('chq-id').value;
      const companyId = document.getElementById('chq-company').value;
      const accountId = document.getElementById('chq-account').value;
      const chequeNumber = document.getElementById('chq-number').value.trim();
      const chequeDate = document.getElementById('chq-date').value;
      const payeeName = document.getElementById('chq-payee').value.trim();
      const amount = parseFloat(document.getElementById('chq-amount').value);
      const status = document.getElementById('chq-status').value;
      const acPayee = document.getElementById('chq-ac-payee').checked;
      const remarks = document.getElementById('chq-remarks').value.trim();
      const amountWords = numberToIndianWords(amount);

      if (!companyId || !accountId || !chequeNumber || !chequeDate || !payeeName || !Number.isFinite(amount) || amount <= 0) {
        showToast('Please fill all required fields and enter an amount greater than zero.', true);
        return;
      }

      const confirmed = await showConfirm(
        id ? 'Confirm Cheque Update' : 'Confirm Save Cheque',
        `Save Cheque #${chequeNumber} for ${payeeName} (INR ${formatINR(amount)}) as ${status}?`,
        'Save Cheque'
      );
      if (!confirmed) return;

      try {
        const saved = await SGC_DB.saveCheque({
          id: id || undefined,
          companyId,
          accountId,
          chequeNumber,
          chequeDate,
          payeeName,
          amount,
          amountWords,
          acPayee,
          remarks,
          status
        });
        state.editingChequeId = saved.id;
        document.getElementById('chq-id').value = saved.id;
        document.getElementById('cheque-form-heading').textContent = `Editing Cheque #${saved.chequeNumber}`;
        document.getElementById('btn-save-cheque').textContent = 'Update Cheque Record';
        await refreshAllData();
        showToast(`Cheque #${saved.chequeNumber} saved.`);
      } catch (err) {
        showToast(err.message, true);
      }
    });

    // Save & Reset Per-Account Print Calibration
    document.getElementById('btn-save-calibration').addEventListener('click', async () => {
      const acctId = document.getElementById('chq-account').value;
      if (!acctId) {
        showToast('Select a Bank Account first to save its print calibration.', true);
        return;
      }
      try {
        const cfg = readCalibrationInputs();
        await SGC_DB.updateAccountPrintConfig(acctId, cfg);
        await refreshAllData();
        showToast('Print alignment saved for this bank account.');
      } catch (err) {
        showToast(err.message, true);
      }
    });

    document.getElementById('btn-reset-calibration').addEventListener('click', () => {
      loadCalibrationInputs(SGC_DB.DEFAULT_PRINT_CONFIG);
      updateChequePreview();
      showToast('Calibration reset to default measurements.');
    });

    // Printing Buttons
    document.getElementById('btn-print-test-plain').addEventListener('click', () => {
      triggerChequePrint(true);
    });

    document.getElementById('btn-print-cheque-final').addEventListener('click', async () => {
      const ok = await showConfirm(
        'Print on Genuine Bank Cheque Leaf',
        'Ensure a genuine bank-issued cheque leaf is properly loaded in the printer tray. Proceed to print?',
        'Print Cheque'
      );
      if (ok) triggerChequePrint(false);
    });

    // Register Filters & Actions
    ['reg-search', 'reg-filter-company', 'reg-filter-account', 'reg-filter-status', 'reg-date-from', 'reg-date-to'].forEach((id) => {
      document.getElementById(id).addEventListener('input', renderRegister);
      document.getElementById(id).addEventListener('change', renderRegister);
    });

    document.getElementById('btn-clear-filters').addEventListener('click', () => {
      document.getElementById('reg-search').value = '';
      document.getElementById('reg-filter-company').value = '';
      document.getElementById('reg-filter-account').value = '';
      document.getElementById('reg-filter-status').value = '';
      document.getElementById('reg-date-from').value = '';
      document.getElementById('reg-date-to').value = '';
      renderRegister();
    });

    document.getElementById('btn-export-csv').addEventListener('click', exportRegisterCSV);
    document.getElementById('btn-print-register').addEventListener('click', printRegisterReport);

    // Delegated Record Actions (Edit / Delete Companies, Accounts, Cheques)
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === 'edit-company') {
        const comp = getCompanyById(id);
        if (!comp) return;
        document.getElementById('comp-id').value = comp.id;
        document.getElementById('comp-name').value = comp.name;
        document.getElementById('comp-address').value = comp.address || '';
        document.getElementById('comp-phone').value = comp.phone || '';
        document.getElementById('comp-email').value = comp.email || '';
        document.getElementById('company-form-title').textContent = 'Edit Company';
        document.getElementById('btn-cancel-company').classList.remove('hidden');
        document.getElementById('company-form').scrollIntoView({ behavior: 'smooth' });
      }

      if (action === 'delete-company') {
        const comp = getCompanyById(id);
        if (!comp) return;
        const ok = await showConfirm(
          'Delete Company',
          `Delete "${comp.name}" along with all its linked bank accounts and cheque records? This cannot be undone.`,
          'Delete Company',
          true
        );
        if (ok) {
          await SGC_DB.deleteCompany(id);
          resetCompanyForm();
          await refreshAllData();
          showToast('Company and linked records deleted.');
        }
      }

      if (action === 'edit-account') {
        const acct = getAccountById(id);
        if (!acct) return;
        document.getElementById('acct-id').value = acct.id;
        document.getElementById('acct-company').value = acct.companyId;
        document.getElementById('acct-bank').value = acct.bankName;
        document.getElementById('acct-branch').value = acct.branchName;
        document.getElementById('acct-holder').value = acct.holderName;
        document.getElementById('acct-number').value = acct.accountNumber || '';
        document.getElementById('acct-ifsc').value = acct.ifscCode || '';
        document.getElementById('acct-notes').value = acct.printingNotes || '';
        document.getElementById('account-form-title').textContent = 'Edit Bank Account';
        document.getElementById('btn-cancel-account').classList.remove('hidden');
        document.getElementById('account-form').scrollIntoView({ behavior: 'smooth' });
      }

      if (action === 'calibrate-account') {
        const acct = getAccountById(id);
        if (!acct) return;
        switchView('cheque-form');
        document.getElementById('chq-company').value = acct.companyId;
        populateChequeAccountsDropdown(acct.companyId, acct.id);
        setTimeout(() => {
          document.getElementById('print-studio-card').scrollIntoView({ behavior: 'smooth' });
        }, 120);
      }

      if (action === 'delete-account') {
        const acct = getAccountById(id);
        if (!acct) return;
        const ok = await showConfirm(
          'Delete Bank Account',
          `Delete ${acct.bankName} (${maskAccountNumber(acct.accountNumber)}) and its associated cheque records?`,
          'Delete Account',
          true
        );
        if (ok) {
          await SGC_DB.deleteAccount(id);
          resetAccountForm();
          await refreshAllData();
          showToast('Bank account deleted.');
        }
      }

      if (action === 'edit-cheque') {
        const chq = state.cheques.find((c) => c.id === id);
        if (!chq) return;
        switchView('cheque-form');
        state.editingChequeId = chq.id;
        document.getElementById('chq-id').value = chq.id;
        document.getElementById('cheque-form-heading').textContent = `Editing Cheque #${chq.chequeNumber}`;
        document.getElementById('btn-save-cheque').textContent = 'Update Cheque Record';
        document.getElementById('chq-company').value = chq.companyId;
        populateChequeAccountsDropdown(chq.companyId, chq.accountId);
        document.getElementById('chq-number').value = chq.chequeNumber;
        document.getElementById('chq-date').value = chq.chequeDate;
        document.getElementById('chq-payee').value = chq.payeeName;
        document.getElementById('chq-amount').value = chq.amount;
        document.getElementById('chq-status').value = chq.status;
        document.getElementById('chq-ac-payee').checked = Boolean(chq.acPayee);
        document.getElementById('chq-remarks').value = chq.remarks || '';
        updateChequePreview();
      }

      if (action === 'delete-cheque') {
        const chq = state.cheques.find((c) => c.id === id);
        if (!chq) return;
        const ok = await showConfirm(
          'Delete Cheque Record',
          `Permanently delete Cheque #${chq.chequeNumber} (${chq.payeeName})?`,
          'Delete Cheque',
          true
        );
        if (ok) {
          await SGC_DB.deleteCheque(id);
          if (state.editingChequeId === id) resetChequeForm();
          await refreshAllData();
          showToast('Cheque record deleted.');
        }
      }
    });

    // Backup, Restore & Wipe
    document.getElementById('btn-export-json').addEventListener('click', handleExportJSONBackup);

    document.getElementById('btn-restore-json').addEventListener('click', async () => {
      const fileInput = document.getElementById('restore-file-input');
      const file = fileInput.files && fileInput.files[0];
      if (!file) {
        showToast('Please choose a JSON backup file first.', true);
        return;
      }

      const confirmed = await showConfirm(
        'Confirm Backup Restore',
        'Restoring from this backup will replace all current companies, bank accounts, and cheque records on this device. Continue?',
        'Restore Now'
      );
      if (!confirmed) return;

      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        await SGC_DB.importAllData(parsed);
        fileInput.value = '';
        resetCompanyForm();
        resetAccountForm();
        resetChequeForm();
        await refreshAllData();
        showToast('Backup restored successfully.');
      } catch (err) {
        showToast('Restore failed: ' + (err.message || 'Invalid JSON file.'), true);
      }
    });

    document.getElementById('btn-wipe-data').addEventListener('click', async () => {
      const firstConfirm = await showConfirm(
        'Erase All Local Data?',
        'This will permanently delete all companies, bank accounts, calibration settings, and cheque records from this device.',
        'Yes, Continue',
        true
      );
      if (!firstConfirm) return;

      const secondConfirm = await showConfirm(
        'Final Warning - Irreversible Action',
        'Are you 100% sure? All local data will be wiped permanently.',
        'Permanently Erase Everything',
        true
      );
      if (!secondConfirm) return;

      try {
        await SGC_DB.wipeAllData();
        resetCompanyForm();
        resetAccountForm();
        resetChequeForm();
        await refreshAllData();
        showToast('All local data erased from device.');
      } catch (err) {
        showToast(err.message || 'Failed to wipe data.', true);
      }
    });
  }

  // --- Bootstrap ---
  async function init() {
    try {
      await SGC_DB.open();
      initNetworkIndicator();
      registerServiceWorker();
      bindEvents();
      resetChequeForm();
      await refreshAllData();
    } catch (err) {
      console.error('Initialization error:', err);
      showToast('Database error: ' + err.message, true);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
