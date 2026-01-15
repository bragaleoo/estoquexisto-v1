
import { Supervisor, Maquina } from './types';

export const SUPERVISORES: Supervisor[] = [
  { id: 1, nome: 'AJU 01' },
  { id: 2, nome: 'AJU 02' },
  { id: 3, nome: 'AJU 03' },
  { id: 4, nome: 'SE 04' },
  { id: 5, nome: 'SE 05' },
  { id: 6, nome: 'MAC 01' },
  { id: 7, nome: 'MAC 02' },
];

export const DUMMY_MAQUINAS: Maquina[] = [
  { id: '1', serial: 'SN-A1B2-001', pedido_id: 'p1', import_id: 'i1', status_estoque: 'VENDIDA', criado_em: '2023-10-01T10:00:00Z' },
  { id: '2', serial: 'SN-A1B2-002', pedido_id: 'p1', import_id: 'i1', status_estoque: 'VENDIDA', criado_em: '2023-10-01T10:00:00Z' },
  { id: '3', serial: 'SN-C3D4-003', pedido_id: 'p2', import_id: 'i2', status_estoque: 'DISPONIVEL', criado_em: '2023-10-02T11:00:00Z' },
  { id: '4', serial: 'SN-C3D4-004', pedido_id: 'p2', import_id: 'i2', status_estoque: 'DISPONIVEL', criado_em: '2023-10-02T11:00:00Z' },
  { id: '5', serial: 'SN-E5F6-005', pedido_id: 'p3', import_id: 'i3', status_estoque: 'VENDIDA', criado_em: '2023-10-05T09:00:00Z' },
  { id: '6', serial: 'SN-E5F6-006', pedido_id: 'p3', import_id: 'i3', status_estoque: 'VENDIDA', criado_em: '2023-10-05T09:00:00Z' },
  { id: '7', serial: 'SN-G7H8-007', pedido_id: 'p4', import_id: 'i4', status_estoque: 'DISPONIVEL', criado_em: '2023-10-10T14:00:00Z' },
  { id: '8', serial: 'SN-G7H8-008', pedido_id: 'p4', import_id: 'i4', status_estoque: 'DISPONIVEL', criado_em: '2023-10-10T14:00:00Z' },
  { id: '9', serial: 'SN-I9J0-009', pedido_id: 'p5', import_id: 'i5', status_estoque: 'VENDIDA', criado_em: '2023-10-12T15:00:00Z' },
  { id: '10', serial: 'SN-I9J0-010', pedido_id: 'p5', import_id: 'i5', status_estoque: 'VENDIDA', criado_em: '2023-10-12T15:00:00Z' },
  { id: '11', serial: 'SN-K1L2-011', pedido_id: 'p6', import_id: 'i6', status_estoque: 'DISPONIVEL', criado_em: '2023-10-18T16:00:00Z' },
  { id: '12', serial: 'SN-K1L2-012', pedido_id: 'p6', import_id: 'i6', status_estoque: 'DISPONIVEL', criado_em: '2023-10-18T16:00:00Z' },
  { id: '13', serial: 'SN-M3N4-013', pedido_id: 'p7', import_id: 'i7', status_estoque: 'VENDIDA', criado_em: '2023-11-01T08:00:00Z' },
  { id: '14', serial: 'SN-M3N4-014', pedido_id: 'p7', import_id: 'i7', status_estoque: 'DISPONIVEL', criado_em: '2023-11-01T08:00:00Z' },
  { id: '15', serial: 'SN-O5P6-015', pedido_id: 'p8', import_id: 'i8', status_estoque: 'VENDIDA', criado_em: '2023-11-02T11:30:00Z' },
];
