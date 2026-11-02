import { describe, expect, it } from 'vitest';
import { MV_MAX, MV_MIN, formatValue, formatValueShort, overall, parseValue, squadValue, valueChange, fillStats } from '../src';

describe('Giá trị chuyển nhượng (M/B, đồng)', () => {
  it('đọc M / B / triệu / tỷ, mặc định M, bước 0,1', () => {
    expect(parseValue('150M')).toBe(1500);
    expect(parseValue('150 m')).toBe(1500);
    expect(parseValue('150')).toBe(1500);
    expect(parseValue('1.2B')).toBe(12000);
    expect(parseValue('1,2 tỷ')).toBe(12000);
    expect(parseValue('2,5 triệu')).toBe(25);
    expect(parseValue('1.25B')).toBe(12500);
    expect(parseValue('999B')).toBe(MV_MAX);
    expect(parseValue('1M')).toBe(MV_MIN);
    expect(parseValue('120M đ')).toBe(1200);
  });
  it('từ chối giá sai', () => {
    for (const s of ['', 'abc', '0.5M', '1000B', '1.25M', '-5M', '5K', '1.2.3B']) expect(parseValue(s), s).toBeNull();
  });
  it('hiển thị đủ số (nhóm nghìn bằng dấu chấm) kèm đ; dạng ngắn M/B cho nhập nhanh', () => {
    expect(formatValue(1500)).toBe('150.000.000 đ');
    expect(formatValue(25)).toBe('2.500.000 đ');
    expect(formatValue(12000)).toBe('1.200.000.000 đ');
    expect(formatValue(MV_MAX)).toBe('999.000.000.000 đ');
    expect(formatValueShort(12500)).toBe('1,25B');
    expect(formatValueShort(10000)).toBe('1B');
    expect(formatValue(null)).toBe('Chưa định giá');
  });
  it('% thay đổi, tổng đội hình, OVR', () => {
    expect(valueChange(1000, 1200)).toBe(20);
    expect(valueChange(1200, 1000)).toBe(-16.7);
    expect(valueChange(null, 1000)).toBeNull();
    expect(squadValue([1000, null, 500])).toBe(1500);
    const o = overall(fillStats({ FIN: 9, SHO: 9, DRI: 9, PAC: 8 }), 'Phải');
    expect(o.pos).toBe('ST');
    expect(o.ovr).toBeGreaterThan(60);
    expect(o.ovr).toBeLessThanOrEqual(100);
  });
});
