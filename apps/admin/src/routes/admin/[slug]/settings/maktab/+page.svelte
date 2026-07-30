<script lang="ts">
  import { toast } from 'svelte-sonner';
  import { page } from '$app/stores';
  import { api } from '$lib/api';
  import { auth } from '$lib/auth.svelte';
  import { BookOpen, Users, ExternalLink, Download, FileDown, ArrowUpDown, ArrowUp, ArrowDown, Plus, Trash2 } from 'lucide-svelte';
  import SkeletonForm from '$lib/components/SkeletonForm.svelte';
  import ErrorCard from '$lib/components/ErrorCard.svelte';
  import {
    type Registration,
    type Term as ExTerm,
    exportStudentCSV,
    exportApplicationsCSV,
    downloadCsv,
    buildBulkReportHtml,
    downloadHtml,
  } from '$lib/maktab-export';

  type Term = ExTerm;

  type FlatStudent = {
    regId: string;
    created_at: string;
    childIndex: number;
    name: string;
    sex: string;
    dob: string;
    ageDisplay: string;
    fatherName: string | null;
    motherName: string | null;
    fatherEmail: string | null;
    motherEmail: string | null;
    monthly_amount_cents: number;
    status: string;
  };

  let masjidSlug = $derived($page.params.slug);
  let masjidId = $derived(auth.admin?.masjid_id ?? '');

  let loading = $state(true);
  let settings = $state<{ enrollment_open: boolean; active_term: Term | null; status_message: string | null } | null>(null);
  let terms = $state<Term[]>([]);
  let registrations = $state<Registration[]>([]);
  let selectedTermId = $state<string>('');
  let error = $state<string | null>(null);

  let saving = $state(false);
  let creating = $state(false);

  let sexFilter = $state<'all' | 'male' | 'female'>('all');
  let sortColumn = $state<'name' | 'sex' | 'age'>('name');
  let sortDir = $state<'asc' | 'desc'>('asc');

  let flatStudents = $derived.by(() => {
    const students: FlatStudent[] = [];
    for (const reg of registrations) {
      for (let i = 0; i < reg.children.length; i++) {
        const child = reg.children[i];
        const dob = new Date(child.dob);
        const now = new Date();
        let years = now.getFullYear() - dob.getFullYear();
        let months = now.getMonth() - dob.getMonth();
        if (months < 0) { years--; months += 12; }
        const ageDisplay = years === 0 ? `${months}m` : `${years}y ${months}m`;

        students.push({
          regId: reg.id,
          created_at: reg.created_at,
          childIndex: i,
          name: child.name,
          sex: child.sex,
          dob: child.dob,
          ageDisplay,
          fatherName: reg.father_name,
          motherName: reg.mother_name,
          fatherEmail: reg.father_email,
          motherEmail: reg.mother_email,
          monthly_amount_cents: reg.monthly_amount_cents,
          status: reg.status,
        });
      }
    }
    return students;
  });

  let displayedStudents = $derived.by(() => {
    let filtered = flatStudents;
    if (sexFilter === 'male') {
      filtered = flatStudents.filter(s => s.sex === 'male');
    } else if (sexFilter === 'female') {
      filtered = flatStudents.filter(s => s.sex === 'female');
    }

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortColumn === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortColumn === 'sex') cmp = a.sex.localeCompare(b.sex);
      else if (sortColumn === 'age') cmp = a.dob.localeCompare(b.dob);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  });

  let studentsActiveCount = $derived(
    flatStudents.filter(s => s.status === 'active' || s.status === 'subscribed').length
  );

  let settingsForm = $state({
    enrollment_open: false,
    status_message: '',
    active_term_id: '',
    assistance_code: '',
  });

  let newTerm = $state({
    name: '',
    length_months: 1,
    billing_months: undefined as number | undefined,
    price_1: '',
    price_2: '',
    price_3plus: '',
  });

  let programInfo = $state<{
    goal: string;
    schedule_days: string;
    schedule_time: string;
    curriculum: { name: string; description: string }[];
    faqs: { question: string; answer: string }[];
  }>({
    goal: '',
    schedule_days: '',
    schedule_time: '',
    curriculum: [],
    faqs: [],
  });

  $effect(() => {
    if (!masjidId) return;
    loadAll();
  });

  $effect(() => {
    if (!masjidId || loading) return;
    void selectedTermId;
    loadRegistrations();
  });

  async function loadAll() {
    if (!masjidId) return;
    loading = true;
    error = null;
    try {
      const [settingsRes, termsRes] = await Promise.all([
        api.getMaktabSettings(masjidId),
        api.listMaktabTerms(masjidId),
      ]);
      settings = settingsRes;
      terms = termsRes.terms ?? [];
      settingsForm = {
        enrollment_open: settingsRes.enrollment_open,
        status_message: settingsRes.status_message ?? '',
        active_term_id: settingsRes.active_term?.id ?? '',
        assistance_code: settingsRes.assistance_code ?? '',
      };
      const pi = settingsRes.program_info;
      programInfo = {
        goal: pi?.goal ?? '',
        schedule_days: pi?.schedule_days ?? '',
        schedule_time: pi?.schedule_time ?? '',
        curriculum: Array.isArray(pi?.curriculum) ? pi.curriculum : [],
        faqs: Array.isArray(pi?.faqs) ? pi.faqs : [],
      };
      if (settingsRes.active_term?.id && !selectedTermId) {
        selectedTermId = settingsRes.active_term.id;
      }
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to load Maktab settings';
    } finally {
      loading = false;
    }
  }

  async function loadRegistrations() {
    if (!masjidId) return;
    try {
      const registrationsRes = await api.listMaktabRegistrations(masjidId, selectedTermId || undefined);
      registrations = registrationsRes.registrations ?? [];
    } catch (e: unknown) {
      // silently ignore; registrations table will show empty
    }
  }

  async function saveSettings(e: Event) {
    e.preventDefault();
    if (!settings) return;
    saving = true;
    error = null;
    try {
      await api.updateMaktabSettings(masjidId, {
        enrollment_open: settingsForm.enrollment_open,
        status_message: settingsForm.status_message || null,
        active_term_id: settingsForm.active_term_id || null,
        assistance_code: settingsForm.assistance_code || null,
        program_info: programInfo,
      });
      toast.success('Maktab settings saved');
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to save settings';
      toast.error('Failed to save');
    } finally {
      saving = false;
    }
  }

  async function activateTerm(id: string) {
    try {
      await api.activateMaktabTerm(masjidId, id);
      toast.success('Term activated');
      await loadAll();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Activation failed');
    }
  }

  async function createTerm(e: Event) {
    e.preventDefault();
    if (!newTerm.name || !newTerm.price_1 || !newTerm.price_2 || !newTerm.price_3plus) return;
    creating = true;
    try {
      await api.createMaktabTerm(masjidId, {
        name: newTerm.name,
        length_months: Number(newTerm.length_months),
        billing_months: newTerm.billing_months,
        price_cents_1: Math.round(Number(newTerm.price_1) * 100),
        price_cents_2: Math.round(Number(newTerm.price_2) * 100),
        price_cents_3plus: Math.round(Number(newTerm.price_3plus) * 100),
      });
      toast.success('Term created');
      newTerm = { name: '', length_months: 1, billing_months: undefined, price_1: '', price_2: '', price_3plus: '' };
      await loadAll();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create term');
    } finally {
      creating = false;
    }
  }

  function toggleSort(column: 'name' | 'sex' | 'age') {
    if (sortColumn === column) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = column;
      sortDir = 'asc';
    }
  }

  function sortIcon(column: 'name' | 'sex' | 'age') {
    if (sortColumn !== column) return ArrowUpDown;
    return sortDir === 'asc' ? ArrowUp : ArrowDown;
  }

  function cycleSexFilter() {
    if (sexFilter === 'all') sexFilter = 'male';
    else if (sexFilter === 'male') sexFilter = 'female';
    else sexFilter = 'all';
  }

  function sexFilterLabel() {
    if (sexFilter === 'all') return 'All';
    if (sexFilter === 'male') return 'Male';
    return 'Female';
  }

  function handleExportBulkReport() {
    if (registrations.length === 0) {
      toast.error('No registrations to export');
      return;
    }
    const term = settings?.active_term ?? terms[0] ?? null;
    if (!term) {
      toast.error('No term selected');
      return;
    }
    const html = buildBulkReportHtml(registrations, term);
    const date = new Date().toISOString().slice(0, 10);
    downloadHtml(html, `maktab-report-${date}.html`);
    toast.success('Report downloaded — open in browser and Print as PDF');
  }

  function handleExportStudentCSV() {
    if (registrations.length === 0) {
      toast.error('No registrations to export');
      return;
    }
    const csv = exportStudentCSV(registrations);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `maktab-students-${date}.csv`);
    toast.success('Student CSV downloaded');
  }

  function handleExportApplicationsCSV() {
    if (registrations.length === 0) {
      toast.error('No registrations to export');
      return;
    }
    const csv = exportApplicationsCSV(registrations);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `maktab-applications-${date}.csv`);
    toast.success('Applications CSV downloaded');
  }

  function formatCents(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString();
  }
</script>

<svelte:head>
  <title>Maktab Settings — Admin</title>
</svelte:head>

<div class="max-w-4xl mx-auto">
  <div class="flex items-center gap-3 mb-2">
    <BookOpen class="text-accent" size={28} />
    <h1 class="text-2xl font-heading font-bold">Maktab Settings</h1>
  </div>
  <p class="text-text-muted text-sm mb-6">Manage enrollment terms, pricing, and registrations.</p>

  {#if loading}
    <SkeletonForm fields={8} />
  {:else if error}
    <ErrorCard message={error} onRetry={loadAll} />
  {:else}
    <div class="space-y-6">
      <form onsubmit={saveSettings} class="bg-surface border border-border rounded-xl p-6 space-y-6">
        <h2 class="font-heading font-semibold text-text">Enrollment</h2>

        <div class="flex flex-col sm:flex-row gap-6 items-start">
          <div class="flex items-center gap-3">
            <input
              id="enrollment_open"
              type="checkbox"
              bind:checked={settingsForm.enrollment_open}
              class="w-5 h-5 rounded border-border text-accent bg-bg"
            />
            <label for="enrollment_open" class="text-sm text-text">
              Enrollment is open
            </label>
          </div>

          <div class="flex-1 w-full">
            <label for="status_message" class="block text-sm text-text-muted mb-1">Closed message (optional)</label>
            <input
              id="status_message"
              type="text"
              bind:value={settingsForm.status_message}
              placeholder="Displayed when enrollment is closed"
              class="w-full"
            />
          </div>
        </div>

        <div>
          <label for="assistance_code" class="block text-sm text-text-muted mb-1">
            Assistance Code
            <span class="text-text-dim text-xs font-normal">(6 characters, shared with families in need)</span>
          </label>
          <input
            id="assistance_code"
            type="text"
            maxlength="6"
            bind:value={settingsForm.assistance_code}
            placeholder="e.g. A1B2C3"
            class="w-full max-w-xs font-mono tracking-widest uppercase"
          />
          <p class="text-xs text-text-muted mt-1">
            Families enter this code in the Card Holder Name field to register under financial aid.
            Leave empty to disable.
          </p>
        </div>

        <div>
          <label for="active_term_id" class="block text-sm text-text-muted mb-1">Active Term</label>
          <select id="active_term_id" class="w-full" bind:value={settingsForm.active_term_id}>
            <option value="">— No active term —</option>
            {#each terms as term}
              <option value={term.id}>{term.name}</option>
            {/each}
          </select>
          {#if settings?.active_term}
            <p class="text-xs text-text-muted mt-1">Currently active: {settings.active_term.name}</p>
          {/if}
        </div>

        <div class="flex items-center justify-between pt-2 border-t border-border">
          <a
            href="/{masjidSlug}/maktab/enroll"
            target="_blank"
            class="text-sm text-accent hover:underline inline-flex items-center gap-1"
          >
            Open enrollment form <ExternalLink size={14} />
          </a>
          <button type="submit" class="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>

      <div class="bg-surface border border-border rounded-xl p-6 space-y-6">
        <h2 class="font-heading font-semibold text-text">Program Info</h2>
        <p class="text-xs text-text-muted">Shown on the public Maktab page. Leave sections empty to hide them.</p>

        <div class="form-group">
          <label for="pi_goal">Goal</label>
          <textarea id="pi_goal" rows="3" class="w-full" bind:value={programInfo.goal} placeholder="The goal of the Evening Islamic Studies is to provide..."></textarea>
        </div>

        <div class="grid sm:grid-cols-2 gap-4">
          <div class="form-group">
            <label for="pi_schedule_days">Schedule days</label>
            <input id="pi_schedule_days" type="text" bind:value={programInfo.schedule_days} class="w-full" placeholder="Tuesday - Thursday" />
          </div>
          <div class="form-group">
            <label for="pi_schedule_time">Schedule time</label>
            <input id="pi_schedule_time" type="text" bind:value={programInfo.schedule_time} class="w-full" placeholder="5:30 PM - 7:00 PM" />
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm text-text-muted">Curriculum</label>
            <button type="button" class="btn-secondary text-xs" onclick={() => programInfo.curriculum = [...programInfo.curriculum, { name: '', description: '' }]}>
              <Plus size={14} /> Add Subject
            </button>
          </div>
          {#if programInfo.curriculum.length === 0}
            <p class="text-sm text-text-muted">No subjects added yet.</p>
          {:else}
            <div class="space-y-3">
              {#each programInfo.curriculum as subject, i}
                <div class="flex gap-3 items-start">
                  <div class="flex-1 grid sm:grid-cols-2 gap-2">
                    <input type="text" bind:value={subject.name} class="w-full" placeholder="Subject name" />
                    <input type="text" bind:value={subject.description} class="w-full" placeholder="Description" />
                  </div>
                  <button type="button" class="btn-secondary text-xs text-red-400 mt-1" onclick={() => programInfo.curriculum = programInfo.curriculum.filter((_, j) => j !== i)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm text-text-muted">FAQs</label>
            <button type="button" class="btn-secondary text-xs" onclick={() => programInfo.faqs = [...programInfo.faqs, { question: '', answer: '' }]}>
              <Plus size={14} /> Add FAQ
            </button>
          </div>
          {#if programInfo.faqs.length === 0}
            <p class="text-sm text-text-muted">No FAQs added yet.</p>
          {:else}
            <div class="space-y-3">
              {#each programInfo.faqs as faq, i}
                <div class="flex gap-3 items-start">
                  <div class="flex-1 grid gap-2">
                    <input type="text" bind:value={faq.question} class="w-full" placeholder="Question" />
                    <textarea rows="2" bind:value={faq.answer} class="w-full" placeholder="Answer"></textarea>
                  </div>
                  <button type="button" class="btn-secondary text-xs text-red-400 mt-1" onclick={() => programInfo.faqs = programInfo.faqs.filter((_, j) => j !== i)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <div class="bg-surface border border-border rounded-xl p-6">
        <h2 class="font-heading font-semibold text-text mb-4">Terms</h2>

        {#if terms.length === 0}
          <p class="text-text-muted text-sm mb-4">No terms created yet.</p>
        {:else}
          <div class="overflow-x-auto mb-6">
            <table class="w-full text-sm">
              <thead class="border-b border-border text-text-muted">
                <tr>
                  <th class="text-left py-2 pr-4">Name</th>
                  <th class="text-left py-2 pr-4">Length</th>
                  <th class="text-left py-2 pr-4">1 child</th>
                  <th class="text-left py-2 pr-4">2 children</th>
                  <th class="text-left py-2 pr-4">3+ children</th>
                  <th class="text-left py-2">Actions</th>
                </tr>
              </thead>
              <tbody class="text-text">
                {#each terms as term}
                  <tr class="border-b border-border/50 last:border-0">
                    <td class="py-3 pr-4 font-medium">{term.name}</td>
                    <td class="py-3 pr-4">{term.length_months} mo</td>
                    <td class="py-3 pr-4">{formatCents(term.prices['1'])}</td>
                    <td class="py-3 pr-4">{formatCents(term.prices['2'])}</td>
                    <td class="py-3 pr-4">{formatCents(term.prices['3plus'])}</td>
                    <td class="py-3">
                      <button
                        type="button"
                        class="btn-secondary text-xs"
                        onclick={() => activateTerm(term.id)}
                        disabled={settings?.active_term?.id === term.id}
                      >
                        {settings?.active_term?.id === term.id ? 'Active' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}

        <form onsubmit={createTerm} class="border-t border-border pt-6">
          <h3 class="font-heading font-semibold text-text mb-3">Create New Term</h3>
          <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div class="form-group sm:col-span-2 lg:col-span-3">
              <label for="term_name">Term Name</label>
              <input id="term_name" type="text" bind:value={newTerm.name} placeholder="e.g. 2026–2027 Academic Year" class="w-full" />
            </div>
            <div class="form-group">
              <label for="term_length">Term Length (months)</label>
              <input id="term_length" type="number" min="1" max="12" bind:value={newTerm.length_months} class="w-full" />
              <p class="text-xs text-text-muted mt-1">Total months in the academic year</p>
            </div>
            <div class="form-group">
              <label for="billing_months">Billing Months</label>
              <input id="billing_months" type="number" min="1" max="12" bind:value={newTerm.billing_months} class="w-full" placeholder="Same as term length" />
              <p class="text-xs text-text-muted mt-1">Months Square charges (e.g. 8 for a 9-month term with Ramadan break)</p>
            </div>
            <div class="form-group">
              <label for="price_1">Price: 1 child</label>
              <input id="price_1" type="number" step="0.01" min="0" bind:value={newTerm.price_1} class="w-full" />
            </div>
            <div class="form-group">
              <label for="price_2">Price: 2 children</label>
              <input id="price_2" type="number" step="0.01" min="0" bind:value={newTerm.price_2} class="w-full" />
            </div>
            <div class="form-group">
              <label for="price_3plus">Price: 3+ children</label>
              <input id="price_3plus" type="number" step="0.01" min="0" bind:value={newTerm.price_3plus} class="w-full" />
            </div>
          </div>
          <button type="submit" class="btn-primary mt-4" disabled={creating}>
            {creating ? 'Creating...' : 'Create Term'}
          </button>
        </form>
      </div>

      <div class="bg-surface border border-border rounded-xl p-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div class="flex items-center gap-2">
            <Users class="text-accent" size={20} />
            <h2 class="font-heading font-semibold text-text">
              Students
              {#if selectedTermId}
                — {terms.find(t => t.id === selectedTermId)?.name ?? ''}
              {/if}
            </h2>
            <span class="badge badge-green text-xs">
              {studentsActiveCount} active
            </span>
            <span class="text-sm text-text-muted">
              {flatStudents.length} total
            </span>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <button type="button" class="btn-secondary text-xs" onclick={cycleSexFilter} class:badge-blue={sexFilter === 'male'} class:badge-purple={sexFilter === 'female'}>
              {sexFilterLabel()}
            </button>
            <select class="w-full sm:w-auto text-xs" bind:value={selectedTermId}>
              <option value="">All Terms</option>
              {#each terms as term}
                <option value={term.id}>{term.name}</option>
              {/each}
            </select>
            <div class="flex gap-1">
              <button type="button" class="btn-secondary text-xs" onclick={handleExportBulkReport} title="Generate printable HTML report">
                <FileDown size={14} /> Report
              </button>
              <button type="button" class="btn-secondary text-xs" onclick={handleExportStudentCSV} title="Download student list as CSV">
                <Download size={14} /> Students CSV
              </button>
              <button type="button" class="btn-secondary text-xs" onclick={handleExportApplicationsCSV} title="Download full applications as CSV">
                <Download size={14} /> Apps CSV
              </button>
            </div>
          </div>
        </div>

        {#if flatStudents.length === 0}
          <p class="text-text-muted text-sm">No registrations yet.</p>
        {:else}
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="border-b border-border text-text-muted">
                <tr>
                  <th class="text-left py-2 pr-4">
                    <button type="button" class="inline-flex items-center gap-1 hover:text-text" onclick={() => toggleSort('name')}>
                      Student {#if sortColumn === 'name'}<svelte:component this={sortIcon('name')} size={12} />{/if}
                    </button>
                  </th>
                  <th class="text-left py-2 pr-4 w-24">
                    <button type="button" class="inline-flex items-center gap-1 hover:text-text" onclick={() => toggleSort('sex')}>
                      Sex {#if sortColumn === 'sex'}<svelte:component this={sortIcon('sex')} size={12} />{/if}
                    </button>
                  </th>
                  <th class="text-left py-2 pr-4 w-24">
                    <button type="button" class="inline-flex items-center gap-1 hover:text-text" onclick={() => toggleSort('age')}>
                      Age {#if sortColumn === 'age'}<svelte:component this={sortIcon('age')} size={12} />{/if}
                    </button>
                  </th>
                  <th class="text-left py-2 pr-4">Parent</th>
                  <th class="text-left py-2 pr-4 w-24">Status</th>
                  <th class="text-left py-2 pr-4 w-28">Monthly</th>
                  <th class="text-left py-2 w-28">Registered</th>
                </tr>
              </thead>
              <tbody class="text-text">
                {#each displayedStudents as student (student.regId + '-' + student.childIndex)}
                  <tr class="border-b border-border/50 last:border-0">
                    <td class="py-3 pr-4 font-medium">{student.name}</td>
                    <td class="py-3 pr-4 capitalize">{student.sex}</td>
                    <td class="py-3 pr-4">{student.ageDisplay}</td>
                    <td class="py-3 pr-4">
                      {student.fatherName || student.motherName || '—'}
                      <div class="text-xs text-text-muted">{student.fatherEmail || student.motherEmail || ''}</div>
                    </td>
                    <td class="py-3 pr-4 capitalize">
                      <span class="badge" class:badge-green={student.status === 'active' || student.status === 'subscribed'} class:badge-yellow={student.status === 'pending'} class:badge-grey={student.status !== 'active' && student.status !== 'subscribed' && student.status !== 'pending'}>
                        {student.status}
                      </span>
                    </td>
                    <td class="py-3 pr-4">{formatCents(student.monthly_amount_cents)}</td>
                    <td class="py-3">{formatDate(student.created_at)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>
