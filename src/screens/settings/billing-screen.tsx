/**
 * BillingScreen — Settings → Billing (cloud). View plan, credit balance,
 * resource usage, billing profile and payment history. Owners can additionally
 * edit the billing profile, cancel/resume the subscription, and void a pending
 * invoice.
 *
 * Purchases (subscribe / buy credits) are intentionally NOT done in-app — the
 * "Manage on web" button opens the web billing page, avoiding App Store / Play
 * in-app-purchase rules for digital goods.
 */
import { useFocusEffect } from '@react-navigation/native';
import { CreditCard, ExternalLink, Pencil, ReceiptText } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button, Screen } from '@/components/ui';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import {
  ApiError,
  Billing,
  FreeLimits,
  MobileOrganization,
  UsageBucket,
  cancelPendingInvoice,
  cancelSubscription,
  getApiUrl,
  getBilling,
  getFreeLimits,
  getOrganization,
  updateBillingProfile,
} from '@/lib/api';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/navigation/auth-context';

const fmtIdr = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—');

const STATUS_TONE: Record<string, 'ok' | 'warn' | 'bad'> = {
  active: 'ok', paid: 'ok', grace: 'warn', pending: 'warn',
  past_due: 'bad', failed: 'bad', expired: 'bad', cancelled: 'bad',
};

function apiMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    try {
      return (JSON.parse(e.body) as { error?: string }).error ?? fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function BillingScreen() {
  const theme = useTheme();
  const { token } = useAuth();

  const [data, setData] = useState<Billing | null>(null);
  const [org, setOrg] = useState<MobileOrganization | null>(null);
  const [free, setFree] = useState<FreeLimits | null>(null);
  const [loading, setLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [npwp, setNpwp] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [confirm, setConfirm] = useState<null | 'cancel' | 'resume' | 'void'>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [billing, orgRes, freeRes] = await Promise.all([
        getBilling(token),
        getOrganization(token).catch(() => null),
        getFreeLimits(token).catch(() => null),
      ]);
      setData(billing);
      setOrg(orgRes);
      setFree(freeRes);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const isOwner = org?.role === 'owner';
  const openWeb = () => Linking.openURL(`${getApiUrl()}/dashboard/settings/billing`);

  function openEdit() {
    if (!data) return;
    setName(data.billingProfile.name ?? '');
    setEmail(data.billingProfile.email ?? '');
    setNpwp(data.billingProfile.npwp ?? '');
    setAddress(data.billingProfile.address ?? '');
    setEditError(null);
    setEditOpen(true);
  }

  async function saveProfile() {
    if (!token || saving) return;
    setSaving(true);
    setEditError(null);
    try {
      await updateBillingProfile(token, {
        billingName: name.trim() || null,
        billingEmail: email.trim() || null,
        npwp: npwp.trim() || null,
        billingAddress: address.trim() || null,
      });
      setEditOpen(false);
      await load();
    } catch (e) {
      setEditError(apiMessage(e, 'Failed to save. Try again.'));
    } finally {
      setSaving(false);
    }
  }

  async function runConfirm() {
    if (!token || !confirm || busy) return;
    setBusy(true);
    try {
      if (confirm === 'cancel') await cancelSubscription(token, false);
      else if (confirm === 'resume') await cancelSubscription(token, true);
      else if (confirm === 'void') await cancelPendingInvoice(token);
      setConfirm(null);
      await load();
    } catch {
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  function toneColor(tone: 'ok' | 'warn' | 'bad') {
    return tone === 'ok' ? '#22C55E' : tone === 'warn' ? '#F59E0B' : theme.destructive;
  }

  if (loading) {
    return (
      <Screen edges={['bottom']}>
        <View style={styles.centered}><ActivityIndicator color={theme.accent} /></View>
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen edges={['bottom']}>
        <View style={styles.centered}>
          <CreditCard color={theme.textSecondary} size={32} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No billing</Text>
          <Text style={[styles.muted, { color: theme.textSecondary }]}>
            Billing isn’t available for this organization.
          </Text>
        </View>
      </Screen>
    );
  }

  const status = data.subscription?.status ?? (data.plan.id === 'free' ? 'free' : 'active');
  const tone = STATUS_TONE[status] ?? 'ok';
  const creditsUnlimited = data.credits.total < 0;
  const pct = creditsUnlimited || data.credits.total === 0
    ? 0
    : Math.min(100, Math.round((data.credits.current / data.credits.total) * 100));

  const freeBuckets: { label: string; b: UsageBucket }[] = [];
  if (free?.freeModels) freeBuckets.push({ label: 'Free models / hour', b: free.freeModels });
  if (free?.nano) freeBuckets.push({ label: 'Nano / day', b: free.nano });
  if (free?.rantai && !free.rantai.unlimited) {
    freeBuckets.push({ label: 'RantAI / day', b: free.rantai.day });
    freeBuckets.push({ label: 'RantAI / week', b: free.rantai.week });
  }

  return (
    <Screen padded={false} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Plan */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.planTop}>
            <View>
              <Text style={[styles.planName, { color: theme.text }]}>{data.plan.name}</Text>
              <Text style={[styles.planPrice, { color: theme.textSecondary }]}>
                {data.plan.priceIdr > 0 ? `${fmtIdr(data.plan.priceIdr)} / mo` : 'Free'}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: `${toneColor(tone)}22` }]}>
              <Text style={[styles.badgeText, { color: toneColor(tone) }]}>{status}</Text>
            </View>
          </View>

          {data.subscription ? (
            <>
              <Text style={[styles.subInfo, { color: theme.textSecondary }]}>
                {data.subscription.cancelAtPeriodEnd
                  ? `Ends ${fmtDate(data.subscription.endsAt ?? data.subscription.currentPeriodEnd)}`
                  : `Renews ${fmtDate(data.subscription.renewsAt ?? data.subscription.currentPeriodEnd)}`}
              </Text>
              {isOwner ? (
                <Pressable
                  onPress={() => setConfirm(data.subscription!.cancelAtPeriodEnd ? 'resume' : 'cancel')}
                  style={styles.subAction}>
                  <Text
                    style={[
                      styles.subActionText,
                      { color: data.subscription.cancelAtPeriodEnd ? theme.accent : theme.destructive },
                    ]}>
                    {data.subscription.cancelAtPeriodEnd ? 'Resume subscription' : 'Cancel subscription'}
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : null}
        </View>

        {/* Pending invoice */}
        {data.pendingInvoice ? (
          <View style={[styles.pendingBox, { backgroundColor: `${theme.accent}12`, borderColor: `${theme.accent}44` }]}>
            <Text style={[styles.pendingText, { color: theme.text }]}>
              Invoice {data.pendingInvoice.invoiceNumber ?? ''} • {fmtIdr(data.pendingInvoice.amountTotal)} due
            </Text>
            <View style={styles.pendingActions}>
              <Pressable onPress={openWeb}>
                <Text style={[styles.payLink, { color: theme.accent }]}>Pay on web</Text>
              </Pressable>
              {isOwner ? (
                <Pressable onPress={() => setConfirm('void')}>
                  <Text style={[styles.payLink, { color: theme.destructive }]}>Cancel</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Credits */}
        <Section theme={theme} title="AI Credits">
          <View style={styles.creditRow}>
            <Text style={[styles.creditNum, { color: theme.text }]}>
              {creditsUnlimited ? '∞' : data.credits.current.toLocaleString('id-ID')}
            </Text>
            <Text style={[styles.creditOf, { color: theme.textSecondary }]}>
              {creditsUnlimited ? 'unlimited' : `of ${data.credits.total.toLocaleString('id-ID')}`}
            </Text>
          </View>
          {!creditsUnlimited && data.credits.total > 0 ? (
            <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
              <View style={[styles.fill, { width: `${pct}%`, backgroundColor: theme.accent }]} />
            </View>
          ) : null}
          <Text style={[styles.creditMeta, { color: theme.textSecondary }]}>
            {data.credits.used.toLocaleString('id-ID')} used
            {data.credits.resetAt ? ` · resets ${fmtDate(data.credits.resetAt)}` : ''}
          </Text>
        </Section>

        {/* Free tier */}
        {freeBuckets.length ? (
          <Section theme={theme} title="Free Tier">
            {freeBuckets.map((f) => (
              <Bucket key={f.label} theme={theme} label={f.label} b={f.b} />
            ))}
          </Section>
        ) : null}

        {/* Resource usage */}
        <Section theme={theme} title="Resource Usage">
          <Meter theme={theme} label="Members" u={data.usage.members} />
          <Meter theme={theme} label="Assistants" u={data.usage.assistants} />
          <Meter theme={theme} label="Storage (MB)" u={data.usage.storageMB} />
          <Meter theme={theme} label="API keys" u={data.usage.apiKeys} />
        </Section>

        {/* Billing profile */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Billing Profile</Text>
            {isOwner ? (
              <Pressable onPress={openEdit} style={styles.editBtn} hitSlop={8}>
                <Pencil color={theme.accent} size={13} />
                <Text style={[styles.editText, { color: theme.accent }]}>Edit</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Info theme={theme} label="Name" value={data.billingProfile.name} />
            <Info theme={theme} label="Email" value={data.billingProfile.email} />
            <Info theme={theme} label="NPWP" value={data.billingProfile.npwp} />
            <Info theme={theme} label="Address" value={data.billingProfile.address} />
          </View>
        </View>

        {/* History */}
        {data.invoices.length || data.creditPacks.length ? (
          <Section theme={theme} title="Payment History">
            {data.invoices.map((inv) => (
              <HistoryRow key={inv.id} theme={theme} title={`Invoice ${inv.invoiceNumber ?? ''}`.trim()}
                amount={fmtIdr(inv.amountTotal)} status={inv.status} date={fmtDate(inv.paidAt ?? inv.createdAt)}
                receiptUrl={inv.receiptUrl ?? inv.paidPdfUrl ?? inv.pdfUrl} />
            ))}
            {data.creditPacks.map((p) => (
              <HistoryRow key={p.id} theme={theme} title={`+${p.creditsGranted.toLocaleString('id-ID')} credits`}
                amount={fmtIdr(p.amountIdr)} status={p.status} date={fmtDate(p.paidAt ?? p.createdAt)}
                receiptUrl={p.receiptUrl} />
            ))}
          </Section>
        ) : null}

        <Button label="Manage / upgrade on web" onPress={openWeb} style={styles.webBtn} />
        <Text style={[styles.webNote, { color: theme.textSecondary }]}>
          Plan changes and credit top-ups are handled on the web.
        </Text>
      </ScrollView>

      {/* Edit profile */}
      <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setEditOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={[styles.sheetTitle, { color: theme.text }]}>Billing profile</Text>
              <ProfileField theme={theme} label="Name" value={name} onChangeText={setName} />
              <ProfileField theme={theme} label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
              <ProfileField theme={theme} label="NPWP" value={npwp} onChangeText={setNpwp} />
              <ProfileField theme={theme} label="Address" value={address} onChangeText={setAddress} multiline />
              {editError ? <Text style={[styles.errText, { color: theme.destructive }]}>{editError}</Text> : null}
              <View style={styles.actions}>
                <Button label="Cancel" variant="outline" onPress={() => setEditOpen(false)} style={styles.flex} />
                <Button label="Save" onPress={saveProfile} loading={saving} style={styles.flex} />
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Confirm cancel/resume/void */}
      <Modal visible={!!confirm} transparent animationType="fade" onRequestClose={() => setConfirm(null)}>
        <Pressable style={styles.backdrop} onPress={() => (busy ? undefined : setConfirm(null))}>
          <Pressable style={[styles.dialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.dialogTitle, { color: theme.text }]}>
              {confirm === 'resume' ? 'Resume subscription?' : confirm === 'void' ? 'Cancel invoice?' : 'Cancel subscription?'}
            </Text>
            <Text style={[styles.dialogMsg, { color: theme.textSecondary }]}>
              {confirm === 'resume'
                ? 'Your subscription will keep renewing.'
                : confirm === 'void'
                  ? 'The unpaid invoice will be voided. Your current plan is unchanged.'
                  : 'You keep access until the period ends, then the plan reverts to Free.'}
            </Text>
            <View style={styles.actions}>
              <Button label="Back" variant="outline" onPress={() => setConfirm(null)} disabled={busy} style={styles.flex} />
              <Button
                label={confirm === 'resume' ? 'Resume' : 'Confirm'}
                variant={confirm === 'resume' ? undefined : 'destructive'}
                onPress={runConfirm}
                loading={busy}
                style={styles.flex}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

type Theme = ReturnType<typeof useTheme>;

function Section({ theme, title, children }: { theme: Theme; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>{children}</View>
    </View>
  );
}

function Meter({ theme, label, u }: { theme: Theme; label: string; u: { current: number; max: number } }) {
  const unlimited = u.max < 0;
  const pct = unlimited || u.max === 0 ? 0 : Math.min(100, Math.round((u.current / u.max) * 100));
  return (
    <View style={styles.meter}>
      <View style={styles.meterTop}>
        <Text style={[styles.meterLabel, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.meterVal, { color: theme.textSecondary }]}>
          {u.current.toLocaleString('id-ID')} / {unlimited ? '∞' : u.max.toLocaleString('id-ID')}
        </Text>
      </View>
      {!unlimited && u.max > 0 ? (
        <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
          <View style={[styles.fill, { width: `${pct}%`, backgroundColor: pct >= 100 ? theme.destructive : theme.accent }]} />
        </View>
      ) : null}
    </View>
  );
}

function Bucket({ theme, label, b }: { theme: Theme; label: string; b: UsageBucket }) {
  const unlimited = b.limit < 0;
  const pct = unlimited || b.limit === 0 ? 0 : Math.min(100, Math.round((b.used / b.limit) * 100));
  return (
    <View style={styles.meter}>
      <View style={styles.meterTop}>
        <Text style={[styles.meterLabel, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.meterVal, { color: theme.textSecondary }]}>
          {b.used.toLocaleString('id-ID')} / {unlimited ? '∞' : b.limit.toLocaleString('id-ID')}
        </Text>
      </View>
      {!unlimited && b.limit > 0 ? (
        <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
          <View style={[styles.fill, { width: `${pct}%`, backgroundColor: pct >= 100 ? theme.destructive : theme.accent }]} />
        </View>
      ) : null}
      {b.resetAt ? (
        <Text style={[styles.bucketReset, { color: theme.textSecondary }]}>resets {fmtDate(b.resetAt)}</Text>
      ) : null}
    </View>
  );
}

function Info({ theme, label, value }: { theme: Theme; label: string; value: string | null }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: value ? theme.text : theme.textSecondary }]} numberOfLines={1}>
        {value || '—'}
      </Text>
    </View>
  );
}

function ProfileField({
  theme, label, value, onChangeText, keyboardType, multiline,
}: {
  theme: Theme; label: string; value: string; onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'email-address'; multiline?: boolean;
}) {
  return (
    <View>
      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        multiline={multiline}
        style={[
          styles.input,
          multiline && { minHeight: 72, textAlignVertical: 'top' },
          { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
        ]}
      />
    </View>
  );
}

function HistoryRow({
  theme, title, amount, status, date, receiptUrl,
}: {
  theme: Theme; title: string; amount: string; status: string; date: string; receiptUrl: string | null;
}) {
  const tone = STATUS_TONE[status] ?? 'warn';
  const color = tone === 'ok' ? '#22C55E' : tone === 'warn' ? '#F59E0B' : theme.destructive;
  return (
    <View style={styles.histRow}>
      <ReceiptText color={theme.textSecondary} size={18} />
      <View style={styles.flex}>
        <Text style={[styles.histTitle, { color: theme.text }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.histMeta, { color: theme.textSecondary }]}>{date} · {amount}</Text>
      </View>
      <Text style={[styles.histStatus, { color }]}>{status}</Text>
      {receiptUrl ? (
        <Pressable onPress={() => Linking.openURL(receiptUrl)} hitSlop={8}>
          <ExternalLink color={theme.accent} size={16} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.six },
  muted: { fontSize: FontSize.base, textAlign: 'center' },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  content: { padding: Spacing.four, gap: Spacing.four, paddingBottom: Spacing.six },

  card: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, padding: Spacing.three },
  section: { gap: Spacing.two },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: Spacing.one },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  planTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  planName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  planPrice: { fontSize: FontSize.base, marginTop: 2 },
  badge: { paddingHorizontal: Spacing.two, paddingVertical: 3, borderRadius: Radius.full },
  badgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, textTransform: 'capitalize' },
  subInfo: { fontSize: FontSize.sm, marginTop: Spacing.two },
  subAction: { marginTop: Spacing.two },
  subActionText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  pendingBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth * 2, padding: Spacing.three, gap: Spacing.two,
  },
  pendingText: { flex: 1, fontSize: FontSize.sm },
  pendingActions: { flexDirection: 'row', gap: Spacing.three },
  payLink: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  creditRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  creditNum: { fontSize: FontSize.title2, fontWeight: FontWeight.bold },
  creditOf: { fontSize: FontSize.base },
  creditMeta: { fontSize: FontSize.sm, marginTop: Spacing.two },
  track: { height: 8, borderRadius: Radius.full, overflow: 'hidden', marginTop: Spacing.two },
  fill: { height: '100%', borderRadius: Radius.full },

  meter: { marginBottom: Spacing.three },
  meterTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meterLabel: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  meterVal: { fontSize: FontSize.sm },
  bucketReset: { fontSize: FontSize.xs, marginTop: 3 },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three, paddingVertical: 5 },
  infoLabel: { fontSize: FontSize.base },
  infoValue: { flex: 1, fontSize: FontSize.base, textAlign: 'right' },

  histRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  histTitle: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  histMeta: { fontSize: FontSize.sm, marginTop: 1 },
  histStatus: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, textTransform: 'capitalize' },

  webBtn: { marginTop: Spacing.two },
  webNote: { fontSize: FontSize.sm, textAlign: 'center' },

  // Edit sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2, padding: Spacing.four, maxHeight: '85%',
  },
  sheetTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, marginBottom: Spacing.one },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginTop: Spacing.three },
  input: {
    minHeight: 46, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: FontSize.md, marginTop: Spacing.one,
  },
  errText: { fontSize: FontSize.sm, marginTop: Spacing.two },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.four },

  // Confirm dialog
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  dialog: {
    width: '100%', maxWidth: 360, borderRadius: Radius.xl, borderWidth: StyleSheet.hairlineWidth * 2,
    padding: Spacing.four, gap: Spacing.three,
  },
  dialogTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, textAlign: 'center' },
  dialogMsg: { fontSize: FontSize.base, textAlign: 'center', lineHeight: 20 },
});
