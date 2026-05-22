'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  Loader2,
  Search,
  Star,
  MapPin,
  Phone,
  Globe,
  Mail,
  Check,
  X,
  ChevronDown,
} from 'lucide-react';
import {
  executarBusca,
  buscarEmailsEmpresa,
  type ResultadoBusca,
} from './actions';

type Setor = {
  id: string;
  slug: string;
  nome: string;
  categoria: string;
  icon: string | null;
};

type Cidade = { id: string; nome: string; estado: string };

type Bairro = {
  id: string;
  cidade_id: string;
  nome: string;
  zona: string | null;
};

export function BuscaClient({
  setores,
  cidades,
  bairros,
}: {
  setores: Setor[];
  cidades: Cidade[];
  bairros: Bairro[];
}) {
  const [setorId, setSetorId] = useState<string>('');
  const [cidadeId, setCidadeId] = useState<string>(cidades[0]?.id ?? '');
  const [bairrosIds, setBairrosIds] = useState<Set<string>>(new Set());
  const [resultados, setResultados] = useState<ResultadoBusca[]>([]);
  const [filtroBairro, setFiltroBairro] = useState<string>('');
  const [erro, setErro] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [emailLoading, setEmailLoading] = useState<Set<string>>(new Set());

  const [isPending, startTransition] = useTransition();

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fecha dropdown ao clicar fora dele
  useEffect(() => {
    if (!dropdownOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setDropdownOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [dropdownOpen]);

  const setoresPorCategoria = useMemo(() => {
    const grupos: Record<string, Setor[]> = {};
    for (const s of setores) {
      grupos[s.categoria] = grupos[s.categoria] ?? [];
      grupos[s.categoria].push(s);
    }
    return grupos;
  }, [setores]);

  const bairrosDaCidade = useMemo(
    () => bairros.filter((b) => b.cidade_id === cidadeId),
    [bairros, cidadeId],
  );

  const bairrosPorZona = useMemo(() => {
    const grupos: Record<string, Bairro[]> = {};
    for (const b of bairrosDaCidade) {
      const k = b.zona ?? 'Outros';
      grupos[k] = grupos[k] ?? [];
      grupos[k].push(b);
    }
    return grupos;
  }, [bairrosDaCidade]);

  const resultadosFiltrados = useMemo(() => {
    if (!filtroBairro) return resultados;
    return resultados.filter((r) => r.bairro === filtroBairro);
  }, [resultados, filtroBairro]);

  const resultadosPorBairro = useMemo(() => {
    const grupos: Record<string, ResultadoBusca[]> = {};
    for (const r of resultadosFiltrados) {
      grupos[r.bairro] = grupos[r.bairro] ?? [];
      grupos[r.bairro].push(r);
    }
    return grupos;
  }, [resultadosFiltrados]);

  function toggleBairro(id: string) {
    setBairrosIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selecionarTodosBairros() {
    setBairrosIds(new Set(bairrosDaCidade.map((b) => b.id)));
  }

  function limparBairros() {
    setBairrosIds(new Set());
  }

  function handleBuscar() {
    setErro(null);
    setDropdownOpen(false); // UX: fecha dropdown ao iniciar busca
    if (!setorId) {
      setErro('Selecione um setor');
      return;
    }
    if (bairrosIds.size === 0) {
      setErro('Selecione pelo menos um bairro');
      return;
    }

    startTransition(async () => {
      const result = await executarBusca({
        setorId,
        cidadeId,
        bairrosIds: Array.from(bairrosIds),
      });
      if (!result.ok) {
        setErro(result.erro);
        setResultados([]);
        return;
      }
      setResultados(result.resultados);
      setFiltroBairro('');
    });
  }

  async function handleBuscarEmail(empresaId: string) {
    setEmailLoading((prev) => new Set(prev).add(empresaId));
    const result = await buscarEmailsEmpresa(empresaId);
    setEmailLoading((prev) => {
      const next = new Set(prev);
      next.delete(empresaId);
      return next;
    });
    if (result.ok) {
      setResultados((prev) =>
        prev.map((r) =>
          r.empresaId === empresaId ? { ...r, emails: result.emails } : r,
        ),
      );
    }
  }

  function exportarCSV() {
    const cols = ['Nome', 'Bairro', 'Endereço', 'Telefone', 'Website', 'Emails', 'Rating', 'Total Reviews', 'Google Maps'];
    const linhas = resultadosFiltrados.map((r) => [
      r.nome,
      r.bairro,
      r.endereco,
      r.telefone ?? '',
      r.website ?? '',
      r.emails.join(';'),
      r.rating?.toFixed(1) ?? '',
      r.totalReviews ?? '',
      r.googleMapsUrl ?? '',
    ]);
    const csv = [cols, ...linhas]
      .map((row) =>
        row
          .map((cell) => {
            const s = String(cell ?? '');
            return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(','),
      )
      .join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lead-radar-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const totalBairrosUnicos = new Set(resultadosFiltrados.map((r) => r.bairro)).size;

  return (
    <div className="space-y-6">
      {/* CONTROLES */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border-base)] rounded-xl p-5">
        <div className="grid md:grid-cols-3 gap-4">
          {/* SETOR */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[1.5px] text-[var(--color-text-mute)] block mb-1.5">
              Setor
            </label>
            <select
              value={setorId}
              onChange={(e) => setSetorId(e.target.value)}
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border-strong)] rounded-lg px-3 py-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none"
            >
              <option value="">Selecione um setor...</option>
              {Object.entries(setoresPorCategoria).map(([cat, lista]) => (
                <optgroup key={cat} label={cat}>
                  {lista.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* CIDADE */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[1.5px] text-[var(--color-text-mute)] block mb-1.5">
              Cidade
            </label>
            <select
              value={cidadeId}
              onChange={(e) => {
                setCidadeId(e.target.value);
                setBairrosIds(new Set());
              }}
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border-strong)] rounded-lg px-3 py-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none"
            >
              {cidades.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} — {c.estado}
                </option>
              ))}
            </select>
          </div>

          {/* BAIRROS MULTI-SELECT */}
          <div className="relative" ref={dropdownRef}>
            <label className="font-mono text-[10px] uppercase tracking-[1.5px] text-[var(--color-text-mute)] block mb-1.5">
              Bairros ({bairrosIds.size})
            </label>
            <button
              type="button"
              onClick={() => setDropdownOpen((v) => !v)}
              className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border-strong)] rounded-lg px-3 py-2.5 text-sm flex items-center justify-between hover:border-[var(--color-accent)]"
            >
              <span className="truncate">
                {bairrosIds.size === 0
                  ? 'Selecione bairros...'
                  : `${bairrosIds.size} bairro${bairrosIds.size > 1 ? 's' : ''} selecionado${bairrosIds.size > 1 ? 's' : ''}`}
              </span>
              <ChevronDown className={`h-4 w-4 transition ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {dropdownOpen ? (
              <div className="absolute top-full mt-1 left-0 right-0 bg-[var(--color-surface)] border border-[var(--color-border-strong)] rounded-lg max-h-80 overflow-y-auto z-50 shadow-2xl">
                <div className="flex border-b border-[var(--color-border-base)] sticky top-0 bg-[var(--color-surface)]">
                  <button
                    type="button"
                    onClick={selecionarTodosBairros}
                    className="flex-1 px-3 py-2 font-mono text-[10px] uppercase tracking-[1px] text-[var(--color-text-mute)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] border-r border-[var(--color-border-base)]"
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={limparBairros}
                    className="flex-1 px-3 py-2 font-mono text-[10px] uppercase tracking-[1px] text-[var(--color-text-mute)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
                  >
                    Limpar
                  </button>
                </div>
                {Object.entries(bairrosPorZona).map(([zona, lista]) => (
                  <div key={zona}>
                    <div className="px-3 py-2 font-mono text-[10px] uppercase tracking-[2px] text-[var(--color-accent)] bg-[rgba(232,255,71,0.03)] border-b border-[var(--color-border-base)]">
                      {zona}
                    </div>
                    {lista.map((b) => (
                      <label
                        key={b.id}
                        className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-[var(--color-surface-2)]"
                      >
                        <input
                          type="checkbox"
                          checked={bairrosIds.has(b.id)}
                          onChange={() => toggleBairro(b.id)}
                          className="h-3.5 w-3.5 accent-[var(--color-accent)]"
                        />
                        <span className="text-sm">{b.nome}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-5">
          <button
            type="button"
            onClick={handleBuscar}
            disabled={isPending}
            className="font-display text-base tracking-[1.5px] bg-[var(--color-accent)] text-black rounded-lg px-6 py-2.5 hover:bg-[#f5ff80] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {isPending ? 'BUSCANDO...' : 'BUSCAR'}
          </button>
          {erro ? (
            <span className="text-sm text-[var(--color-red)]">{erro}</span>
          ) : null}
        </div>
      </div>

      {/* TOOLBAR + RESULTADOS */}
      {resultados.length > 0 ? (
        <>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border-base)] rounded-xl p-4 flex items-center gap-3 flex-wrap">
            <div className="font-mono text-xs text-[var(--color-text-dim)] mr-auto">
              <strong className="text-[var(--color-accent)] text-sm">
                {resultadosFiltrados.length}
              </strong>{' '}
              empresas ·{' '}
              <strong className="text-[var(--color-accent)] text-sm">
                {totalBairrosUnicos}
              </strong>{' '}
              bairros
            </div>
            <select
              value={filtroBairro}
              onChange={(e) => setFiltroBairro(e.target.value)}
              className="bg-[var(--color-surface-2)] border border-[var(--color-border-strong)] rounded-lg px-3 py-1.5 text-xs"
            >
              <option value="">Todos os bairros</option>
              {[...new Set(resultados.map((r) => r.bairro))].sort().map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={exportarCSV}
              className="font-mono text-xs uppercase tracking-[1px] border border-[var(--color-border-strong)] rounded-lg px-3 py-1.5 hover:border-[var(--color-text-dim)] hover:bg-[var(--color-surface-2)]"
            >
              ↓ CSV
            </button>
          </div>

          {Object.entries(resultadosPorBairro).map(([bairro, lista]) => (
            <section key={bairro}>
              <div className="flex items-center gap-3 mb-3 pb-2 border-b border-[var(--color-border-base)]">
                <h2 className="font-display text-xl tracking-[2px] text-[var(--color-text)]">
                  {bairro.toUpperCase()}
                </h2>
                <span className="font-mono text-[10px] uppercase tracking-[1px] text-[var(--color-text-mute)]">
                  {lista.length} empresa{lista.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {lista.map((r) => (
                  <EmpresaCard
                    key={r.empresaId}
                    empresa={r}
                    loading={emailLoading.has(r.empresaId)}
                    onBuscarEmail={() => handleBuscarEmail(r.empresaId)}
                  />
                ))}
              </div>
            </section>
          ))}
        </>
      ) : (
        <div className="border border-dashed border-[var(--color-border-strong)] rounded-xl p-16 text-center">
          <Search className="h-10 w-10 text-[var(--color-text-mute)] mx-auto mb-3 opacity-40" />
          <p className="font-display text-xl tracking-[2px] text-[var(--color-text-dim)]">
            AGUARDANDO BUSCA
          </p>
          <p className="text-sm text-[var(--color-text-mute)] mt-1">
            Selecione setor e bairros, depois clique em Buscar
          </p>
        </div>
      )}
    </div>
  );
}

function EmpresaCard({
  empresa,
  loading,
  onBuscarEmail,
}: {
  empresa: ResultadoBusca;
  loading: boolean;
  onBuscarEmail: () => void;
}) {
  const hasEmail = empresa.emails.length > 0;
  const borderColor = hasEmail
    ? 'border-l-[var(--color-green)]'
    : 'border-l-[var(--color-border-strong)]';

  return (
    <div
      className={`bg-[var(--color-surface)] border border-[var(--color-border-base)] border-l-2 ${borderColor} rounded-xl p-4 hover:border-[var(--color-border-strong)] transition`}
    >
      <div className="flex items-start gap-2 mb-2">
        <h3 className="font-display text-base tracking-[1px] flex-1 leading-tight">
          {empresa.nome}
        </h3>
        {empresa.abertoAgora === true ? (
          <span className="font-mono text-[9px] uppercase tracking-[1px] px-1.5 py-0.5 rounded bg-[rgba(74,222,128,0.15)] text-[var(--color-green)] border border-[rgba(74,222,128,0.3)]">
            Aberto
          </span>
        ) : empresa.abertoAgora === false ? (
          <span className="font-mono text-[9px] uppercase tracking-[1px] px-1.5 py-0.5 rounded bg-[rgba(248,113,113,0.15)] text-[var(--color-red)] border border-[rgba(248,113,113,0.3)]">
            Fechado
          </span>
        ) : null}
      </div>

      {empresa.rating ? (
        <div className="flex items-center gap-1.5 mb-2 text-xs">
          <Star className="h-3 w-3 text-[var(--color-yellow)] fill-current" />
          <span className="font-mono">{empresa.rating.toFixed(1)}</span>
          <span className="font-mono text-[var(--color-text-mute)]">
            ({empresa.totalReviews?.toLocaleString('pt-BR') ?? 0})
          </span>
        </div>
      ) : null}

      <div className="space-y-1.5 text-xs text-[var(--color-text-dim)] mb-3">
        {empresa.endereco ? (
          <div className="flex items-start gap-2">
            <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0 opacity-60" />
            <span className="leading-snug">{empresa.endereco}</span>
          </div>
        ) : null}
        {empresa.telefone ? (
          <div className="flex items-center gap-2">
            <Phone className="h-3 w-3 opacity-60" />
            <a href={`tel:${empresa.telefone}`} className="hover:text-[var(--color-accent)]">
              {empresa.telefone}
            </a>
          </div>
        ) : null}
        {empresa.website ? (
          <div className="flex items-center gap-2">
            <Globe className="h-3 w-3 opacity-60" />
            <a
              href={empresa.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-blue)] hover:text-[var(--color-accent)] truncate"
            >
              {new URL(empresa.website).hostname.replace(/^www\./, '')}
            </a>
          </div>
        ) : null}
      </div>

      <div className="pt-3 border-t border-[var(--color-border-base)]">
        {!empresa.website ? (
          <span className="font-mono text-[10px] text-[var(--color-text-mute)]">
            — sem site cadastrado
          </span>
        ) : loading ? (
          <div className="flex items-center gap-2 text-xs text-[var(--color-blue)]">
            <Loader2 className="h-3 w-3 animate-spin" />
            Analisando site com IA...
          </div>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={onBuscarEmail}
              className="font-mono text-[10px] uppercase tracking-[1px] bg-[rgba(96,165,250,0.15)] text-[var(--color-blue)] border border-[rgba(96,165,250,0.3)] rounded-md px-2.5 py-1 hover:bg-[rgba(96,165,250,0.25)] flex items-center gap-1.5"
            >
              <Mail className="h-3 w-3" />
              {hasEmail ? 'Re-buscar email' : 'Buscar email'}
            </button>
            {hasEmail ? (
              <div className="flex flex-wrap gap-1.5">
                {empresa.emails.map((e) => (
                  <a
                    key={e}
                    href={`mailto:${e}`}
                    className="inline-flex items-center gap-1 font-mono text-[10px] bg-[rgba(74,222,128,0.1)] border border-[rgba(74,222,128,0.25)] rounded px-1.5 py-0.5 text-[var(--color-green)] hover:bg-[rgba(74,222,128,0.2)]"
                  >
                    <Check className="h-2.5 w-2.5" />
                    {e}
                  </a>
                ))}
              </div>
            ) : (
              <span className="font-mono text-[10px] text-[var(--color-text-mute)] flex items-center gap-1">
                <X className="h-2.5 w-2.5" />
                nenhum encontrado
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
