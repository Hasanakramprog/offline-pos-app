import React, { useEffect, useState } from 'react';
import { Save, RefreshCw, Globe, Download, Upload, AlertTriangle, RotateCcw } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { toast } from '../store/toastStore';
import { Button } from '../components/Common/Button';
import { useLang } from '../i18n/LangContext';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="card space-y-4">
    <h2 className="text-base font-semibold border-b border-pos-border pb-2">{title}</h2>
    {children}
  </div>
);

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div>
    <label className="text-sm font-medium text-pos-muted block mb-1">{label}</label>
    {children}
    {hint && <p className="text-xs text-pos-muted mt-1">{hint}</p>}
  </div>
);

export const SettingsPage: React.FC = () => {
  const { settings, save, load } = useSettingsStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const { t, lang, setLang } = useLang();

  const [form, setForm] = useState({
    store_name: '',
    usd_to_lbp_rate: '',
    receipt_footer: '',
    printer_share_name: '',
  });
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(false);

  useEffect(() => {
    setForm({
      store_name: settings.store_name,
      usd_to_lbp_rate: String(settings.usd_to_lbp_rate),
      receipt_footer: settings.receipt_footer,
      printer_share_name: settings.printer_share_name || '',
    });
  }, [settings]);

  const handleSave = async () => {
    if (!form.store_name.trim()) { toast.error('Store name is required'); return; }
    const rate = Number(form.usd_to_lbp_rate);
    if (isNaN(rate) || rate <= 0) { toast.error('Exchange rate must be a positive number'); return; }
    setSaving(true);
    try {
      await save({
        store_name: form.store_name.trim(),
        usd_to_lbp_rate: rate,
        receipt_footer: form.receipt_footer,
        printer_share_name: form.printer_share_name.trim(),
      });
      toast.success('Settings saved successfully');
    } catch {
      toast.error('Failed to save settings');
    } finally { setSaving(false); }
  };

  const handleReload = async () => { await load(); toast.info('Settings reloaded'); };

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));


  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('settings_title')}</h1>
          <p className="text-pos-muted text-sm mt-1">{t('settings_subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={handleReload}>{t('reload_btn')}</Button>
          {isAdmin && <Button icon={<Save size={16} />} loading={saving} onClick={handleSave}>{t('save_settings')}</Button>}
        </div>
      </div>

      {!isAdmin && (
        <div className="px-4 py-3 bg-pos-warning/10 border border-pos-warning/30 rounded-xl text-sm text-pos-warning">
          {t('admin_only_warn')}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── 🌐 Language / اللغة ─────────────────────────────────── */}
        <Section title={t('section_language')}>
          <p className="text-sm text-pos-muted">{t('lang_subtitle')}</p>
          <div className="grid grid-cols-2 gap-3">
            {/* English */}
            <button
              onClick={() => setLang('en')}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200
                ${lang === 'en'
                  ? 'border-pos-primary bg-pos-primary/10 text-pos-primary shadow-sm'
                  : 'border-pos-border hover:border-pos-muted text-pos-muted hover:text-pos-text'}`}
            >
              <Globe size={28} />
              <span className="font-semibold text-sm">English</span>
              <span className="text-[11px] opacity-60 font-mono">LTR</span>
            </button>

            {/* Arabic */}
            <button
              onClick={() => setLang('ar')}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200
                ${lang === 'ar'
                  ? 'border-pos-primary bg-pos-primary/10 text-pos-primary shadow-sm'
                  : 'border-pos-border hover:border-pos-muted text-pos-muted hover:text-pos-text'}`}
            >
              <span className="text-2xl leading-none" style={{ fontFamily: 'Noto Kufi Arabic, sans-serif' }}>ع</span>
              <span className="font-semibold text-sm" style={{ fontFamily: 'Noto Kufi Arabic, sans-serif' }}>العربية</span>
              <span className="text-[11px] opacity-60 font-mono">RTL</span>
            </button>
          </div>
          {/* Active badge */}
          <p className="text-xs text-pos-muted text-center">
            {lang === 'en' ? '✓ English is active' : '✓ العربية مفعّلة'}
          </p>
        </Section>

        {/* ── 🏪 Store ─────────────────────────────────────────────── */}
        <Section title={t('section_store')}>
          <Field label={t('store_name_field')} hint={t('store_name_hint')}>
            <input className="input" value={form.store_name} onChange={e => f('store_name', e.target.value)} disabled={!isAdmin} />
          </Field>
          <Field label={t('receipt_footer_field')}>
            <input className="input" value={form.receipt_footer} onChange={e => f('receipt_footer', e.target.value)} disabled={!isAdmin} />
          </Field>
        </Section>

        {/* ── 💱 Currency ──────────────────────────────────────────── */}
        <Section title={t('section_currency')}>
          <div className="p-3 bg-pos-bg rounded-xl space-y-1">
            <p className="text-xs text-pos-muted">{t('current_currencies')}</p>
            <div className="flex items-center gap-3">
              <span className="badge-yellow">LBP — Lebanese Lira (LL)</span>
              <span className="badge-blue">USD — US Dollar ($)</span>
            </div>
          </div>
          <Field
            label={t('rate_label')}
            hint={`${t('rate_hint_prefix')} ${Number(form.usd_to_lbp_rate).toLocaleString()} LL`}
          >
            <input
              className="input font-mono text-lg"
              type="number" min="1" step="100"
              value={form.usd_to_lbp_rate}
              onChange={e => f('usd_to_lbp_rate', e.target.value)}
              disabled={!isAdmin}
            />
          </Field>
          <div className="p-3 bg-pos-success/10 border border-pos-success/20 rounded-xl text-sm text-pos-success">
            {t('rate_used_in')}
          </div>
        </Section>

        {/* ── 📋 System Info ───────────────────────────────────────── */}
        <Section title={t('section_system')}>
          <div className="space-y-3 text-sm">
            {([
              [t('sys_currency_primary'),   'LBP (Lebanese Lira)'],
              [t('sys_currency_secondary'),  'USD (US Dollar)'],
              [t('sys_tax'),                 t('sys_no_tax')],
              [t('sys_payment'),             t('sys_cash_only')],
              [t('sys_user'),                `${user?.full_name} (${user?.role})`],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex justify-between items-center border-b border-pos-border/50 pb-2">
                <span className="text-pos-muted">{k}</span>
                <span className="font-medium">{v}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── 💾 Backup & Restore ───────────────────────────────── */}
        <Section title={t('section_backup')}>
          <p className="text-sm text-pos-muted">{t('backup_desc')}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* ── Export ── */}
            <div className="rounded-xl border border-pos-border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-pos-success/15 flex items-center justify-center flex-shrink-0">
                  <Download size={16} className="text-pos-success" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{t('export_backup')}</p>
                  <p className="text-xs text-pos-muted">.db file</p>
                </div>
              </div>
              <Button
                className="w-full !bg-pos-success/15 !text-pos-success hover:!bg-pos-success/25 border border-pos-success/30"
                icon={<Download size={15} />}
                onClick={async () => {
                  const path = await (window as any).electronAPI.file.backup();
                  if (path) toast.success(`${t('backup_saved')} ${path}`);
                  else toast.info(t('backup_cancelled'));
                }}
              >
                {t('export_backup')}
              </Button>
            </div>

            {/* ── Import / Restore ── */}
            <div className="rounded-xl border border-pos-danger/30 bg-pos-danger/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-pos-danger/15 flex items-center justify-center flex-shrink-0">
                  <Upload size={16} className="text-pos-danger" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-pos-danger">{t('import_backup')}</p>
                  <p className="text-xs text-pos-muted">{t('import_backup_desc')}</p>
                </div>
              </div>

              {restoreSuccess ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-3 py-2 bg-pos-success/10 border border-pos-success/30 rounded-lg">
                    <span className="text-xs text-pos-success font-medium">{t('import_success')}</span>
                  </div>
                  <Button
                    className="w-full"
                    icon={<RotateCcw size={15} />}
                    onClick={() => window.location.reload()}
                  >
                    {t('reload_app')}
                  </Button>
                </div>
              ) : (
                <Button
                  className="w-full !bg-pos-danger/15 !text-pos-danger hover:!bg-pos-danger/25 border border-pos-danger/30"
                  icon={importing ? undefined : <Upload size={15} />}
                  loading={importing}
                  onClick={async () => {
                    if (!window.confirm(t('import_confirm'))) return;
                    setImporting(true);
                    try {
                      const result = await (window as any).electronAPI.file.restore();
                      if (result?.cancelled) { setImporting(false); return; }
                      if (result?.success) {
                        setRestoreSuccess(true);
                        toast.success(t('import_success'));
                      } else {
                        toast.error(`${t('import_failed')} ${result?.error ?? 'unknown'}`);
                      }
                    } catch (err: any) {
                      toast.error(`${t('import_failed')} ${err?.message ?? 'unknown'}`);
                    } finally {
                      setImporting(false);
                    }
                  }}
                >
                  {t('import_backup')}
                </Button>
              )}
            </div>
          </div>

          {/* Warning note */}
          <div className="flex items-start gap-2 px-3 py-2 bg-pos-warning/10 border border-pos-warning/20 rounded-lg text-xs text-pos-warning">
            <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
            <span>{t('import_backup_desc')}</span>
          </div>
        </Section>

        {/* ── 🖨️ Hardware & Printer ─────────────────────────────────── */}
        <Section title="Hardware & Printing">
          <Field label="Receipt Printer Share Name" hint="Example: ReceiptPrinter. Share your USB printer in Windows settings and enter its share name here to enable cash drawer kicking.">
            <input className="input" value={form.printer_share_name} onChange={e => f('printer_share_name', e.target.value)} disabled={!isAdmin} />
          </Field>
          <div className="pt-2">
            <Button
              variant="secondary"
              onClick={async () => {
                if (!form.printer_share_name) { toast.error('Enter a printer share name first'); return; }
                const res = await window.electronAPI.hardware.openDrawer(form.printer_share_name);
                if (res.success) toast.success('Cash drawer kick command sent!');
                else toast.error('Failed: ' + res.error);
              }}
            >
              Test Cash Drawer
            </Button>
          </div>
        </Section>

      </div>
    </div>
  );
};
