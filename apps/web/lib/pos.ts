/** Lớp màu theo tuyến của vị trí (thẻ vị trí `.posb`). */
export const lineCls = (pos: string) => (pos === 'GK' ? 'gk' : ['CB', 'LB', 'RB'].includes(pos) ? 'df' : pos === 'ST' ? 'fw' : 'mf');
