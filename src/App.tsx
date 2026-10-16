import { useState, useCallback, useEffect } from 'react';
import { Shield, ShieldAlert, ShieldCheck, Mail, Zap, Clock, TrendingUp, Trash2, ChevronDown, ChevronUp, AlertTriangle, Eye, Bug, DollarSign, Lock, Frown, Sparkles, Target, ArrowRight, Activity, BarChart3, FileSearch, Globe, Link as LinkIcon, User, Scan, Check } from 'lucide-react';
import { analyzeWithAI, parseRawEmail, SAMPLE_EMAILS, type EmailInput, type AnalysisResult, type RedFlag } from '@/lib/analysis';
import { saveAnalysis, fetchAnalyses, deleteAnalysis, type EmailAnalysisRecord } from '@/lib/storage';

type View = 'analyzer' | 'dashboard';

const sev: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  critical: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  high: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  low: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' },
};

const catIcon: Record<string, any> = {
  'Domain Impersonation': Bug,
  'Domain Reputation': Globe,
  'Email Authentication': Lock,
  'Link Safety': LinkIcon,
  'Urgency / Pressure': Clock,
  'Financial Request': DollarSign,
  'Authority Claim': ShieldAlert,
  'Investment Scam': Target,
  'Credential Theft': Lock,
  'Language Anomaly': Frown,
  'Sender Mismatch': Mail,
  'Too Good to Be True': Sparkles,
};

function App() {
  const [view, setView] = useState<View>('analyzer');
  const [rawSender, setRawSender] = useState('');
  const [rawContent, setRawContent] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [history, setHistory] = useState<EmailAnalysisRecord[]>([]);
  const [expandedFlag, setExpandedFlag] = useState<number | null>(null);

  const loadHistory = useCallback(async () => {
    const records = await fetchAnalyses(100);
    setHistory(records);
  }, []);

  useEffect(() => {
    if (view === 'dashboard') loadHistory();
  }, [view, loadHistory]);

  const handleAnalyze = useCallback(async () => {
    if (!rawSender.trim() && !rawContent.trim()) return;
    setAnalyzing(true);
    setResult(null);
    const parsed = parseRawEmail(rawSender, rawContent);
    const input: EmailInput = {
      sender_email: parsed.sender_email,
      sender_name: parsed.sender_name,
      subject: parsed.subject,
      body: parsed.body,
    };
    const analysis = await analyzeWithAI(input);
    setResult(analysis);
    setAnalyzing(false);
    await saveAnalysis({
      sender_email: analysis.sender_email,
      sender_name: analysis.sender_name,
      subject: analysis.subject,
      body: analysis.body,
      risk_score: analysis.risk_score,
      verdict: analysis.verdict,
      red_flags: analysis.red_flags,
      summary: analysis.summary,
      domain_age_days: analysis.domain_age_days,
      spf_dkim_dmarc_pass: analysis.spf_dkim_dmarc_pass,
    });
  }, [rawSender, rawContent]);

  const handleSample = (idx: number) => {
    const sample = SAMPLE_EMAILS[idx];
    setRawSender(sample.sender);
    setRawContent(sample.content);
    setResult(null);
  };

  const handleClear = () => {
    setRawSender('');
    setRawContent('');
    setResult(null);
  };

  const handleDelete = async (id: string) => {
    await deleteAnalysis(id);
    setHistory(prev => prev.filter(h => h.id !== id));
  };

  const stats = {
    total: history.length,
    dangerous: history.filter(h => h.verdict === 'DANGEROUS').length,
    suspicious: history.filter(h => h.verdict === 'SUSPICIOUS').length,
    safe: history.filter(h => h.verdict === 'SAFE').length,
    avgScore: history.length > 0 ? Math.round(history.reduce((s, h) => s + h.risk_score, 0) / history.length) : 0,
  };

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-stone-800 antialiased">
      <header className="border-b border-stone-200/80 bg-white/85 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-5 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-stone-900 tracking-tight">Aegis</span>
                <span className="text-[11px] text-stone-400 font-medium hidden sm:inline">email security scanner</span>
              </div>
            </div>
            <nav className="flex items-center gap-1 p-0.5 rounded-lg bg-stone-100 border border-stone-200">
              <button
                onClick={() => setView('analyzer')}
                className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${view === 'analyzer' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
              >
                <span className="flex items-center gap-1.5">
                  <Scan className="w-3.5 h-3.5" />
                  Scan
                </span>
              </button>
              <button
                onClick={() => setView('dashboard')}
                className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${view === 'dashboard' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
              >
                <span className="flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" />
                  History
                </span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 sm:px-6 py-10 sm:py-14">
        {view === 'analyzer' ? (
          <AnalyzerView
            rawSender={rawSender}
            setRawSender={setRawSender}
            rawContent={rawContent}
            setRawContent={setRawContent}
            result={result}
            analyzing={analyzing}
            onAnalyze={handleAnalyze}
            onSample={handleSample}
            onClear={handleClear}
            expandedFlag={expandedFlag}
            setExpandedFlag={setExpandedFlag}
            historyCount={stats.total}
          />
        ) : (
          <DashboardView
            history={history}
            stats={stats}
            onDelete={handleDelete}
            onAnalyze={() => setView('analyzer')}
            loading={history.length === 0}
          />
        )}
      </main>

      <footer className="border-t border-stone-200/80 mt-12">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-[11px] text-stone-400">Aegis — check before you click.</p>
            <p className="text-[11px] text-stone-400">For educational purposes only. Always trust your instincts.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

interface AnalyzerViewProps {
  rawSender: string;
  setRawSender: (v: string) => void;
  rawContent: string;
  setRawContent: (v: string) => void;
  result: AnalysisResult | null;
  analyzing: boolean;
  onAnalyze: () => void;
  onSample: (idx: number) => void;
  onClear: () => void;
  expandedFlag: number | null;
  setExpandedFlag: (v: number | null) => void;
  historyCount: number;
}

function AnalyzerView({ rawSender, setRawSender, rawContent, setRawContent, result, analyzing, onAnalyze, onSample, onClear, expandedFlag, setExpandedFlag, historyCount }: AnalyzerViewProps) {
  const canAnalyze = !!(rawSender.trim() || rawContent.trim());

  return (
    <div className="space-y-8">
      <div className="max-w-2xl">
        <h1 className="text-2xl sm:text-[28px] font-bold text-stone-900 tracking-tight leading-snug">
          Paste a suspicious email. Get an honest breakdown of what's wrong with it.
        </h1>
        <p className="mt-3 text-stone-500 text-[14px] leading-relaxed max-w-lg">
          Aegis checks sender domains, looks for urgency tactics, inspects links, and flags the manipulation patterns phishing emails rely on — then explains each one in plain English.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-stone-400 font-medium uppercase tracking-wider mr-1">Try an example</span>
        {SAMPLE_EMAILS.map((sample, i) => (
          <button
            key={i}
            onClick={() => onSample(i)}
            className={`px-2.5 py-1 text-[12px] font-medium rounded-md border transition-colors ${
              sample.tag === 'danger' ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' :
              sample.tag === 'suspicious' ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' :
              'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            {sample.label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          <div className="rounded-xl bg-white border border-stone-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-100 flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-stone-500" />
              <h3 className="text-[13px] font-semibold text-stone-800">Paste the email</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-[11px] text-stone-500 mb-1.5 font-medium flex items-center gap-1.5">
                  <User className="w-3 h-3" />
                  Who sent it
                </label>
                <input
                  type="text"
                  value={rawSender}
                  onChange={e => setRawSender(e.target.value)}
                  placeholder='"John Doe" <partner@sequoia-cap-seed.com>'
                  className="w-full px-3 py-2 rounded-lg bg-stone-50 border border-stone-200 text-[13px] text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-200 transition-all"
                />
                <p className="text-[11px] text-stone-400 mt-1">Name and email, or just the email address.</p>
              </div>
              <div>
                <label className="block text-[11px] text-stone-500 mb-1.5 font-medium flex items-center gap-1.5">
                  <Mail className="w-3 h-3" />
                  The email itself
                </label>
                <textarea
                  value={rawContent}
                  onChange={e => setRawContent(e.target.value)}
                  placeholder="Copy and paste the whole thing — subject line and body."
                  rows={10}
                  className="w-full px-3 py-2 rounded-lg bg-stone-50 border border-stone-200 text-[13px] text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-200 transition-all resize-none font-mono leading-relaxed"
                />
                <p className="text-[11px] text-stone-400 mt-1">Start with the subject line if you can. Aegis will separate it automatically.</p>
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  onClick={onAnalyze}
                  disabled={!canAnalyze || analyzing}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-stone-900 text-white font-semibold text-[13px] hover:bg-stone-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {analyzing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      Run the scan
                    </>
                  )}
                </button>
                <button
                  onClick={onClear}
                  className="px-4 py-2.5 rounded-lg bg-white border border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition-colors text-[13px] font-medium"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {analyzing && <AnalyzingState />}
          {!analyzing && result && (
            <ResultCard result={result} expandedFlag={expandedFlag} setExpandedFlag={setExpandedFlag} />
          )}
          {!analyzing && !result && (
            <EmptyState historyCount={historyCount} />
          )}
        </div>
      </div>
    </div>
  );
}

function AnalyzingState() {
  const steps = ['Parsing email headers', 'Running pattern checks', 'Analyzing with AI', 'Cross-referencing signals', 'Scoring the risk'];
  const [currentStep, setCurrentStep] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep(prev => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 400);
    return () => clearInterval(interval);
  }, [steps.length]);
  return (
    <div className="rounded-xl bg-white border border-stone-200 shadow-sm p-8 min-h-[360px] flex flex-col items-center justify-center">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-full border-[3px] border-stone-100 border-t-stone-900 animate-spin" />
        <Shield className="w-6 h-6 text-stone-700 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>
      <div className="space-y-2 w-full max-w-xs">
        {steps.map((step, i) => (
          <div key={i} className={`flex items-center gap-2.5 text-[13px] transition-opacity ${i <= currentStep ? 'opacity-100' : 'opacity-30'}`}>
            <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 ${i < currentStep ? 'bg-emerald-100' : i === currentStep ? 'bg-stone-900' : 'bg-stone-100'}`}>
              {i < currentStep ? <Check className="w-2 h-2 text-emerald-600" /> : i === currentStep ? <div className="w-1 h-1 rounded-full bg-white animate-pulse" /> : <div className="w-1 h-1 rounded-full bg-stone-300" />}
            </div>
            <span className={i <= currentStep ? 'text-stone-700' : 'text-stone-400'}>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ historyCount }: { historyCount: number }) {
  return (
    <div className="rounded-xl bg-white border border-stone-200 shadow-sm min-h-[360px] flex flex-col items-center justify-center p-8 text-center">
      <div className="w-14 h-14 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-center mb-3">
        <Shield className="w-7 h-7 text-stone-300" />
      </div>
      <h3 className="text-base font-semibold text-stone-800 mb-1.5">Nothing scanned yet</h3>
      <p className="text-[13px] text-stone-500 max-w-[260px] leading-relaxed">
        Drop a sender and some email content on the left, or load an example up top. You'll get a full breakdown of what looks sketchy and why.
      </p>
      {historyCount > 0 && (
        <p className="mt-3 text-[11px] text-stone-400">{historyCount} email{historyCount !== 1 ? 's' : ''} scanned so far</p>
      )}
    </div>
  );
}

function ResultCard({ result, expandedFlag, setExpandedFlag }: { result: AnalysisResult; expandedFlag: number | null; setExpandedFlag: (v: number | null) => void }) {
  const vc = {
    SAFE: { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: ShieldCheck, label: 'Looks clean', ring: 'stroke-emerald-500', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    SUSPICIOUS: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: ShieldAlert, label: "Something's off", ring: 'stroke-amber-500', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
    DANGEROUS: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: ShieldAlert, label: 'This is dangerous', ring: 'stroke-red-500', badge: 'bg-red-100 text-red-700 border-red-200' },
  };
  const config = vc[result.verdict];
  const Icon = config.icon;
  const circumference = 2 * Math.PI * 48;
  const dashOffset = circumference - (result.risk_score / 100) * circumference;

  return (
    <div className="space-y-4">
      <div className={`rounded-xl ${config.bg} border ${config.border} p-5`}>
        <div className="flex items-center gap-5">
          <div className="relative w-28 h-28 flex-shrink-0">
            <svg className="w-28 h-28 -rotate-90" viewBox="0 0 112 112">
              <circle cx="56" cy="56" r="48" fill="none" stroke="currentColor" strokeWidth="5" className="text-black/[0.06]" />
              <circle
                cx="56" cy="56" r="48" fill="none" strokeWidth="5"
                className={config.ring}
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-bold ${config.color}`}>{result.risk_score}</span>
              <span className="text-[9px] text-stone-400 uppercase tracking-wider">risk</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2.5">
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md ${config.badge} border font-semibold text-[12px]`}>
                <Icon className="w-3.5 h-3.5" />
                {config.label}
              </div>
              {result.source === 'merged' && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-stone-900 text-white text-[9px] font-medium uppercase tracking-wider">
                  <Sparkles className="w-2 h-2" />
                  AI + pattern
                </span>
              )}
              {result.source === 'heuristic' && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-stone-200 text-stone-600 text-[9px] font-medium uppercase tracking-wider">
                  Pattern only
                </span>
              )}
            </div>
            <p className="text-[13px] text-stone-700 leading-relaxed">{result.summary}</p>
          </div>
        </div>
      </div>

      {result.red_flags.length > 0 ? (
        <div className="rounded-xl bg-white border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <h3 className="text-[13px] font-semibold text-stone-800">{result.red_flags.length} thing{result.red_flags.length !== 1 ? 's' : ''} to worry about</h3>
            </div>
            <span className="text-[11px] text-stone-400">Tap to expand</span>
          </div>
          <div className="divide-y divide-stone-100">
            {result.red_flags.map((flag, i) => (
              <RedFlagItem key={i} flag={flag} expanded={expandedFlag === i} onToggle={() => setExpandedFlag(expandedFlag === i ? null : i)} />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-5 text-center">
          <ShieldCheck className="w-7 h-7 text-emerald-600 mx-auto mb-1.5" />
          <p className="text-[13px] text-emerald-700 font-medium">Nothing jumped out</p>
          <p className="text-[11px] text-stone-500 mt-1">This one passed all the checks. Still, trust your gut — no scanner catches everything.</p>
        </div>
      )}
    </div>
  );
}

function RedFlagItem({ flag, expanded, onToggle }: { flag: RedFlag; expanded: boolean; onToggle: () => void }) {
  const c = sev[flag.severity] || sev.low;
  const Icon = catIcon[flag.category] || AlertTriangle;
  return (
    <button onClick={onToggle} className="w-full text-left px-4 py-3 hover:bg-stone-50 transition-colors">
      <div className="flex items-start gap-2.5">
        <div className={`w-7 h-7 rounded-lg ${c.bg} ${c.border} border flex items-center justify-center flex-shrink-0 mt-0.5`}>
          <Icon className={`w-3.5 h-3.5 ${c.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${c.text}`}>{flag.severity}</span>
            <span className="text-[10px] text-stone-300">/</span>
            <span className="text-[11px] text-stone-500">{flag.category}</span>
          </div>
          <p className="text-[13px] text-stone-800 mt-0.5 font-medium leading-snug">{flag.description}</p>
          {expanded && (
            <p className="text-[12px] text-stone-500 mt-1.5 leading-relaxed">{flag.detail}</p>
          )}
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-stone-400 flex-shrink-0 mt-1" /> : <ChevronDown className="w-3.5 h-3.5 text-stone-400 flex-shrink-0 mt-1" />}
      </div>
    </button>
  );
}

interface DashboardViewProps {
  history: EmailAnalysisRecord[];
  stats: { total: number; dangerous: number; suspicious: number; safe: number; avgScore: number };
  onDelete: (id: string) => void;
  onAnalyze: () => void;
  loading: boolean;
}

function DashboardView({ history, stats, onDelete, onAnalyze, loading }: DashboardViewProps) {
  const [filter, setFilter] = useState<string>('all');
  const filtered = filter === 'all' ? history : history.filter(h => h.verdict === filter.toUpperCase());

  const cards = [
    { label: 'Total', value: stats.total, icon: Activity, color: 'text-stone-700', bg: 'bg-stone-50', border: 'border-stone-200' },
    { label: 'Dangerous', value: stats.dangerous, icon: ShieldAlert, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
    { label: 'Suspicious', value: stats.suspicious, icon: ShieldAlert, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
    { label: 'Clean', value: stats.safe, icon: ShieldCheck, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">Your scan history</h2>
          <p className="text-[13px] text-stone-500 mt-0.5">Every email you've run through Aegis</p>
        </div>
        <button
          onClick={onAnalyze}
          className="px-3.5 py-2 rounded-lg bg-stone-900 text-white font-semibold text-[13px] hover:bg-stone-800 transition-colors flex items-center gap-2"
        >
          <Zap className="w-3.5 h-3.5" />
          New scan
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className={`rounded-xl ${s.bg} ${s.border} border p-4`}>
              <div className="flex items-center justify-between mb-2">
                <Icon className={`w-4 h-4 ${s.color}`} />
                <TrendingUp className="w-3 h-3 text-stone-300" />
              </div>
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[11px] text-stone-500 mt-0.5">{s.label}</div>
            </div>
          );
        })}
      </div>

      {stats.total > 0 && (
        <div className="rounded-xl bg-white border border-stone-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[13px] font-medium text-stone-700">Average risk across all scans</span>
            <span className={`text-[13px] font-bold ${stats.avgScore >= 60 ? 'text-red-700' : stats.avgScore >= 25 ? 'text-amber-700' : 'text-emerald-700'}`}>{stats.avgScore}/100</span>
          </div>
          <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${stats.avgScore >= 60 ? 'bg-red-500' : stats.avgScore >= 25 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${stats.avgScore}%` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-semibold text-stone-800">All scans</h3>
          {stats.total > 0 && (
            <div className="flex items-center gap-0.5 ml-auto">
              {['all', 'dangerous', 'suspicious', 'safe'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors capitalize ${filter === f ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-xl bg-white border border-stone-200 p-4 animate-pulse h-20" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl bg-white border border-stone-200 p-10 text-center">
            <Shield className="w-8 h-8 text-stone-300 mx-auto mb-2" />
            <p className="text-[13px] text-stone-500">{filter === 'all' ? 'No scans yet. Run your first one and it shows up here.' : `No ${filter} emails found.`}</p>
            {filter === 'all' && (
              <button onClick={onAnalyze} className="mt-3 px-3 py-1.5 rounded-lg bg-stone-100 border border-stone-200 text-stone-700 hover:text-stone-900 hover:bg-stone-200 transition-colors text-[13px] font-medium inline-flex items-center gap-1.5">
                Start a scan <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(record => (
              <HistoryItem key={record.id} record={record} onDelete={() => onDelete(record.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryItem({ record, onDelete }: { record: EmailAnalysisRecord; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const vc = {
    SAFE: { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: ShieldCheck },
    SUSPICIOUS: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: ShieldAlert },
    DANGEROUS: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: ShieldAlert },
  };
  const config = vc[record.verdict as keyof typeof vc] || vc.SAFE;
  const Icon = config.icon;
  const flags = Array.isArray(record.red_flags) ? record.red_flags : [];
  const date = new Date(record.analyzed_at);

  return (
    <div className={`rounded-xl bg-white border ${config.border} overflow-hidden transition-colors hover:bg-stone-50`}>
      <div className="p-3.5 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg ${config.bg} ${config.border} border flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-4 h-4 ${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${config.color}`}>{record.verdict}</span>
            <span className="text-[10px] text-stone-300">/</span>
            <span className="text-[11px] text-stone-500">{record.risk_score}/100</span>
            {flags.length > 0 && (
              <>
                <span className="text-[10px] text-stone-300">/</span>
                <span className="text-[11px] text-stone-500">{flags.length} flag{flags.length !== 1 ? 's' : ''}</span>
              </>
            )}
          </div>
          <p className="text-[13px] text-stone-800 mt-0.5 truncate font-medium">{record.subject || '(no subject)'}</p>
          <p className="text-[11px] text-stone-500 mt-0.5 truncate">{record.sender_name ? `${record.sender_name} <${record.sender_email || '?'}>` : record.sender_email || 'Unknown sender'}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[11px] text-stone-400 hidden sm:inline">{date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <button onClick={() => setExpanded(!expanded)} className="p-1 rounded-md hover:bg-stone-100 transition-colors">
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-stone-500" /> : <ChevronDown className="w-3.5 h-3.5 text-stone-500" />}
          </button>
          <button onClick={onDelete} className="p-1 rounded-md hover:bg-red-50 transition-colors">
            <Trash2 className="w-3.5 h-3.5 text-stone-400 hover:text-red-600" />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-3.5 pb-3.5 space-y-3 border-t border-stone-100">
          {record.summary && (
            <div className="pt-2.5">
              <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-1">What's going on</p>
              <p className="text-[13px] text-stone-700">{record.summary}</p>
            </div>
          )}
          {flags.length > 0 && (
            <div>
              <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-1.5">Flags</p>
              <div className="space-y-1">
                {flags.map((flag: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-[12px]">
                    <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${flag.severity === 'critical' ? 'bg-red-500' : flag.severity === 'high' ? 'bg-orange-500' : flag.severity === 'medium' ? 'bg-amber-500' : 'bg-sky-500'}`} />
                    <span className="text-stone-700">{flag.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {record.body && (
            <div>
              <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-1">Original email</p>
              <pre className="text-[11px] text-stone-500 whitespace-pre-wrap font-mono bg-stone-50 rounded-lg p-2.5 max-h-40 overflow-y-auto border border-stone-100">{record.body}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
