import { formatDuration, reportToCsv, type UsageDailyRow } from '@acorde/core';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/**
 * Exportação de relatórios. Inclui apenas tempos agregados por aplicação e dia
 * — nunca domínios bloqueados, conversas ou hábitos sensíveis.
 */
export async function exportCsv(rows: UsageDailyRow[], label: string): Promise<void> {
  const csv = reportToCsv(rows);
  const name = `acorde-ja-${label}.csv`;
  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    return;
  }
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(csv);
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Exportar relatório' });
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export async function exportPdf(params: {
  title: string;
  totalMs: number;
  byApp: { appName: string; usedMs: number }[];
  focusMs: number;
  exceptions: number;
}): Promise<void> {
  const rows = params.byApp.map((a) => `<tr><td>${esc(a.appName)}</td><td style="text-align:right">${formatDuration(a.usedMs)}</td></tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,Inter,Helvetica,sans-serif;color:#000;padding:32px}
    h1{font-size:22px;margin:0 0 4px} p{color:#555;margin:0 0 24px}
    .big{font-size:36px;font-weight:700;margin:8px 0 24px}
    table{width:100%;border-collapse:collapse} td{padding:8px 0;border-bottom:1px solid #ddd}
    footer{margin-top:32px;color:#888;font-size:11px}
  </style></head><body>
    <h1>Acorde Já — Relatório</h1><p>${esc(params.title)}</p>
    <div class="big">${formatDuration(params.totalMs)}</div>
    <table>${rows}</table>
    <p style="margin-top:24px">Foco: ${formatDuration(params.focusMs)} · Excepções concedidas: ${params.exceptions}</p>
    <footer>Menos tela. Mais vida. Dados medidos pelo sistema operativo do dispositivo.</footer>
  </body></html>`;
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Exportar relatório' });
}
