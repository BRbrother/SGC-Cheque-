/**
 * SGC Cheque Manager - IndexedDB Storage Engine
 * 100% Local On-Device Storage | Shekhawat Groups of Companies
 */

const SGC_DB = (() => {
  const DB_NAME = 'SGCChequeManagerDB';
  const DB_VERSION = 1;
  let dbInstance = null;

  const DEFAULT_PRINT_CONFIG = {
    pageWidthMm: 203,
    pageHeightMm: 93,
    fontSizePt: 11,
    printScale: 1.0,
    dateX: 152,
    dateY: 9,
    dateLetterSpacing: 3.2,
    payeeX: 24,
    payeeY: 23,
    wordsX: 30,
    wordsY: 33,
    wordsWidth: 115,
    amountX: 156,
    amountY: 42,
    acPayeeX: 14,
    acPayeeY: 12
  };

  function open() {
    return new Promise((resolve, reject) => {
      if (dbInstance) {
        resolve(dbInstance);
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('companies')) {
          const companyStore = db.createObjectStore('companies', { keyPath: 'id' });
          companyStore.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains('accounts')) {
          const accountStore = db.createObjectStore('accounts', { keyPath: 'id' });
          accountStore.createIndex('companyId', 'companyId', { unique: false });
        }

        if (!db.objectStoreNames.contains('cheques')) {
          const chequeStore = db.createObjectStore('cheques', { keyPath: 'id' });
          chequeStore.createIndex('companyId', 'companyId', { unique: false });
          chequeStore.createIndex('accountId', 'accountId', { unique: false });
          chequeStore.createIndex('chequeDate', 'chequeDate', { unique: false });
          chequeStore.createIndex('status', 'status', { unique: false });
        }

        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = event.target.result;
        dbInstance.onversionchange = () => {
          dbInstance.close();
          dbInstance = null;
        };
        resolve(dbInstance);
      };

      request.onerror = (event) => {
        reject(new Error('Failed to open local IndexedDB: ' + (event.target.error?.message || 'Unknown error')));
      };
    });
  }

  function generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  function tx(storeName, mode = 'readonly') {
    return open().then((db) => {
      const transaction = db.transaction(storeName, mode);
      return transaction.objectStore(storeName);
    });
  }

  function getAll(storeName) {
    return tx(storeName, 'readonly').then((store) => {
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    });
  }

  function getById(storeName, id) {
    return tx(storeName, 'readonly').then((store) => {
      return new Promise((resolve, reject) => {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    });
  }

  function put(storeName, item) {
    return tx(storeName, 'readwrite').then((store) => {
      return new Promise((resolve, reject) => {
        const req = store.put(item);
        req.onsuccess = () => resolve(item);
        req.onerror = () => reject(req.error);
      });
    });
  }

  function remove(storeName, id) {
    return tx(storeName, 'readwrite').then((store) => {
      return new Promise((resolve, reject) => {
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    });
  }

  // --- Companies ---
  async function getCompanies() {
    const list = await getAll('companies');
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }

  async function saveCompany(data) {
    const now = new Date().toISOString();
    const record = {
      id: data.id || generateId('comp'),
      name: String(data.name || '').trim(),
      address: String(data.address || '').trim(),
      phone: String(data.phone || '').trim(),
      email: String(data.email || '').trim(),
      createdAt: data.createdAt || now,
      updatedAt: now
    };
    if (!record.name) throw new Error('Company name is required.');
    return put('companies', record);
  }

  async function deleteCompany(companyId) {
    const accounts = await getAccounts();
    const companyAccounts = accounts.filter((a) => a.companyId === companyId);
    const cheques = await getCheques();
    const companyCheques = cheques.filter((c) => c.companyId === companyId);

    for (const chq of companyCheques) {
      await remove('cheques', chq.id);
    }
    for (const acc of companyAccounts) {
      await remove('accounts', acc.id);
    }
    await remove('companies', companyId);
    return true;
  }

  // --- Bank Accounts ---
  async function getAccounts() {
    const list = await getAll('accounts');
    return list.sort((a, b) => a.bankName.localeCompare(b.bankName));
  }

  async function saveAccount(data) {
    const now = new Date().toISOString();
    const existing = data.id ? await getById('accounts', data.id) : null;
    const printConfig = {
      ...DEFAULT_PRINT_CONFIG,
      ...(existing?.printConfig || {}),
      ...(data.printConfig || {})
    };
    const record = {
      id: data.id || generateId('acct'),
      companyId: String(data.companyId || '').trim(),
      bankName: String(data.bankName || '').trim(),
      branchName: String(data.branchName || '').trim(),
      holderName: String(data.holderName || '').trim(),
      accountNumber: String(data.accountNumber || '').trim(),
      ifscCode: String(data.ifscCode || '').trim().toUpperCase(),
      printingNotes: String(data.printingNotes || '').trim(),
      printConfig,
      createdAt: existing?.createdAt || data.createdAt || now,
      updatedAt: now
    };
    if (!record.companyId) throw new Error('Please select a company.');
    if (!record.bankName) throw new Error('Bank name is required.');
    if (!record.branchName) throw new Error('Branch name is required.');
    if (!record.holderName) throw new Error('Account holder name is required.');
    return put('accounts', record);
  }

  async function updateAccountPrintConfig(accountId, printConfig) {
    const existing = await getById('accounts', accountId);
    if (!existing) throw new Error('Bank account not found.');
    existing.printConfig = {
      ...DEFAULT_PRINT_CONFIG,
      ...(existing.printConfig || {}),
      ...printConfig
    };
    existing.updatedAt = new Date().toISOString();
    return put('accounts', existing);
  }

  async function deleteAccount(accountId) {
    const cheques = await getCheques();
    const acctCheques = cheques.filter((c) => c.accountId === accountId);
    for (const chq of acctCheques) {
      await remove('cheques', chq.id);
    }
    await remove('accounts', accountId);
    return true;
  }

  // --- Cheques ---
  async function getCheques() {
    const list = await getAll('cheques');
    return list.sort((a, b) => {
      const dateDiff = (b.chequeDate || '').localeCompare(a.chequeDate || '');
      if (dateDiff !== 0) return dateDiff;
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });
  }

  async function saveCheque(data) {
    const now = new Date().toISOString();
    const chequeNumber = String(data.chequeNumber || '').trim();
    const accountId = String(data.accountId || '').trim();
    const companyId = String(data.companyId || '').trim();
    const payeeName = String(data.payeeName || '').trim();
    const chequeDate = String(data.chequeDate || '').trim();
    const amount = Number(data.amount);

    if (!companyId) throw new Error('Company is required.');
    if (!accountId) throw new Error('Bank account is required.');
    if (!chequeNumber) throw new Error('Cheque number is required.');
    if (!chequeDate) throw new Error('Cheque date is required.');
    if (!payeeName) throw new Error('Payee name is required.');
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Amount must be greater than zero.');
    }

    // Prevent duplicate cheque number within the same bank account
    const allCheques = await getCheques();
    const duplicate = allCheques.find(
      (c) =>
        c.accountId === accountId &&
        c.chequeNumber.toLowerCase() === chequeNumber.toLowerCase() &&
        c.id !== data.id
    );
    if (duplicate) {
      throw new Error(`Cheque #${chequeNumber} already exists for this bank account.`);
    }

    const existing = data.id ? await getById('cheques', data.id) : null;
    const record = {
      id: data.id || generateId('chq'),
      companyId,
      accountId,
      chequeNumber,
      chequeDate,
      payeeName,
      amount: Math.round(amount * 100) / 100,
      amountWords: String(data.amountWords || '').trim(),
      acPayee: Boolean(data.acPayee),
      remarks: String(data.remarks || '').trim(),
      status: ['Draft', 'Issued', 'Cleared', 'Cancelled'].includes(data.status)
        ? data.status
        : 'Draft',
      createdAt: existing?.createdAt || data.createdAt || now,
      updatedAt: now
    };
    return put('cheques', record);
  }

  async function deleteCheque(chequeId) {
    await remove('cheques', chequeId);
    return true;
  }

  // --- Meta & Backup ---
  async function getMeta(key) {
    const rec = await getById('meta', key);
    return rec ? rec.value : null;
  }

  async function setMeta(key, value) {
    return put('meta', { key, value });
  }

  async function exportAllData() {
    const [companies, accounts, cheques, lastBackup] = await Promise.all([
      getCompanies(),
      getAccounts(),
      getCheques(),
      getMeta('lastBackupAt')
    ]);
    const backupDate = new Date().toISOString();
    await setMeta('lastBackupAt', backupDate);
    return {
      app: 'SGC Cheque Manager',
      organization: 'Shekhawat Groups of Companies',
      schemaVersion: 1,
      exportedAt: backupDate,
      previousBackupAt: lastBackup,
      data: {
        companies,
        accounts,
        cheques
      }
    };
  }

  async function importAllData(payload) {
    if (!payload || typeof payload !== 'object' || !payload.data) {
      throw new Error('Invalid backup file structure.');
    }
    const { companies, accounts, cheques } = payload.data;
    if (!Array.isArray(companies) || !Array.isArray(accounts) || !Array.isArray(cheques)) {
      throw new Error('Corrupted backup file: missing companies, accounts, or cheques arrays.');
    }

    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['companies', 'accounts', 'cheques', 'meta'], 'readwrite');
      transaction.onerror = () => reject(new Error('Failed to restore data into IndexedDB.'));
      transaction.oncomplete = () => resolve(true);

      const compStore = transaction.objectStore('companies');
      const acctStore = transaction.objectStore('accounts');
      const chqStore = transaction.objectStore('cheques');
      const metaStore = transaction.objectStore('meta');

      compStore.clear();
      acctStore.clear();
      chqStore.clear();

      companies.forEach((c) => {
        if (c && c.id && c.name) compStore.put(c);
      });
      accounts.forEach((a) => {
        if (a && a.id && a.companyId && a.bankName) {
          a.printConfig = { ...DEFAULT_PRINT_CONFIG, ...(a.printConfig || {}) };
          acctStore.put(a);
        }
      });
      cheques.forEach((ch) => {
        if (ch && ch.id && ch.companyId && ch.accountId && ch.chequeNumber) {
          chqStore.put(ch);
        }
      });
      metaStore.put({ key: 'lastBackupAt', value: new Date().toISOString() });
    });
  }

  async function wipeAllData() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['companies', 'accounts', 'cheques', 'meta'], 'readwrite');
      transaction.onerror = () => reject(new Error('Failed to erase local database.'));
      transaction.oncomplete = () => resolve(true);

      transaction.objectStore('companies').clear();
      transaction.objectStore('accounts').clear();
      transaction.objectStore('cheques').clear();
      transaction.objectStore('meta').clear();
    });
  }

  return {
    DEFAULT_PRINT_CONFIG,
    open,
    getCompanies,
    saveCompany,
    deleteCompany,
    getAccounts,
    saveAccount,
    updateAccountPrintConfig,
    deleteAccount,
    getCheques,
    saveCheque,
    deleteCheque,
    getMeta,
    setMeta,
    exportAllData,
    importAllData,
    wipeAllData
  };
})();
