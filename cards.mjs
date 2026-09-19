const svg=(body,viewBox='0 0 24 24')=>`<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
export const metricIcons={
 blue:svg('<path d="M3 10h18l-2-6H5l-2 6Zm2 2v9h14v-9M9 21v-6h6v6M8 4l-1 6m5-6v6m4-6 1 6"/><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>'),
 cyan:svg('<path fill="currentColor" stroke="none" d="M12 2a8 8 0 0 0-8 8c0 5 8 13 8 13s8-8 8-13a8 8 0 0 0-8-8Zm0 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"/>'),
 green:svg('<path fill="currentColor" stroke="none" d="M3 14h4v8H3zm7-6h4v14h-4zm7-7h4v21h-4z"/>'),
 yellow:svg('<circle cx="12" cy="7" r="3" fill="currentColor"/><path d="M6 21v-4a6 6 0 0 1 12 0v4Z" fill="currentColor"/><path d="M5 4a3 3 0 0 0 0 6M19 4a3 3 0 0 1 0 6M2 19v-3a4 4 0 0 1 3-4m17 7v-3a4 4 0 0 0-3-4"/>')
};
export function quickIllustration(tab){
 const images={
 geo:'<path d="m10 125 70-110 45 150 60-150 50 130 50-130"/><path d="m0 45 320 65M0 110l320-80M45 0l60 180m100-180 50 180"/><path d="M204 30a19 19 0 0 0-19 19c0 17 19 36 19 36s19-19 19-36a19 19 0 0 0-19-19Z" fill="currentColor"/><circle cx="204" cy="49" r="6" stroke="#071626"/>',
 photos:'<path d="M80 20h225v120H80zM80 57h225M80 94h225M120 20v120m50-120v120m50-120v120m45-120v120"/><path d="M152 93h27l10-15h39l10 15h35v67H152Z" fill="#142e4c"/><circle cx="213" cy="125" r="26"/><circle cx="213" cy="125" r="17"/><path d="M99 26v22m11-22v22m30-22v22m50 37v22m40-59v22m45-22v22"/>',
 reports:'<path d="M100 18v138h202M108 120l37-27 42 8 40-55 43 10"/><path d="M121 156V120h25v36m25 0V101h25v55m25 0V67h25v89m25 0V32h25v124" fill="currentColor"/>',
 market:'<path d="m85 165 60-90 35 33 50-88 88 145Z" fill="#142e4c"/><path d="m230 20-8 64 25-25 20 30M145 75l-7 37 20-11 22 7M230 20V3h32l-11 8 11 7h-32"/>'
 };
 return `<span class="quick-art">${svg(images[tab]||images.reports,'0 0 320 180')}</span>`;
}
