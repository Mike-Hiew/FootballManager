// Kiểu DTO dùng chung server ↔ client (chỉ kiểu, không có mã chạy).
import type { Stats } from '@san7/core';

export type Role = 'admin' | 'captain' | 'member' | 'guest';

export interface PlayerDTO {
  id: string;
  fullName: string;
  nick: string | null;
  /** chỉ thành viên đội thấy */
  dob: string | null;
  avatarUrl: string | null;
  num: number | null;
  foot: string;
  payType: string;
  /** loại quỹ áp dụng từ tháng sau (nếu đang chờ đổi) */
  nextPayType: string | null;
  stats: Stats;
  styles: string[];
  isCaptain: boolean;
  status: string;
  hasAccount: boolean;
  /** chỉ ĐT thấy */
  phone: string | null;
}

export interface AttendanceDTO { status: 'di' | 'nghi'; byCaptain: boolean; lePaid: boolean }

export interface MvpVoteDTO {
  status: 'open' | 'done' | 'need';
  closesAt: string;
  decidedBy: string | null;
  /** số phiếu đã bỏ — ai cũng thấy */
  ballots: number;
  /** tally chỉ ĐT thấy khi đang mở; mọi người thấy sau khi chốt */
  tally: Array<[string, number]> | null;
  myBallot: string | null;
}

export interface ClaimDTO { id: string; playerId: string; goals: number; assists: number; status: string }

export interface MatchDTO {
  id: string;
  date: string;
  time: string | null;
  kickoffAt: string;
  opponent: string;
  venue: string | null;
  type: string;
  cost: number | null;
  fee: number | null;
  note: string | null;
  scoreUs: number | null;
  scoreThem: number | null;
  voteState: 'open' | 'closed' | null;
  formation: string | null;
  lineup: Array<string | null> | null;
  mvpPlayerId: string | null;
  attendance: Record<string, AttendanceDTO>;
  events: Record<string, { goals: number; assists: number }>;
  claims: ClaimDTO[];
  mvpVote: MvpVoteDTO | null;
}

export interface TeamDTO {
  id: string;
  name: string;
  foundedOn: string | null;
  slogan: string | null;
  photoUrl: string | null;
  awardBootUrl: string | null;
  awardAssistUrl: string | null;
  homeName: string | null;
  homeAddress: string | null;
  homeMapUrl: string | null;
  homeDays: number[];
  homeFrom: string | null;
  homeTo: string | null;
  homeCost: number;
  rules: string[];
  formation: string;
  lineup: Array<string | null>;
  monthlyFee: number | null;
  perMatchFee: number | null;
  plan: { minutes: number; periods: number; min: number | null };
  fullSquad: number;
  duesReminder: boolean;
  captainNames: string[];
  inviteCode: string | null;
}

export interface ApprovalsDTO {
  joins: Array<{ id: string; createdAt: string; phone: string; payload: Record<string, unknown> }>;
  edits: Array<{ id: string; playerId: string; createdAt: string; payload: Record<string, unknown> }>;
  claims: Array<{ id: string; matchId: string; playerId: string; goals: number; assists: number; createdAt: string }>;
  mvpNeed: string[];
  /** thành viên báo đã đóng tiền, chờ ĐT xác nhận */
  payments: Array<{ requestId: string; playerId: string; label: string; amount: number; declaredAt: string }>;
  count: number;
}

export interface TeamView {
  team: TeamDTO;
  role: Role;
  canEdit: boolean;
  myPlayerId: string | null;
  userId: string;
  players: PlayerDTO[];
  /** người đã rời đội — chỉ để hiện tên trong lịch sử */
  formerPlayers: Array<{ id: string; fullName: string; nick: string | null; num: number | null }>;
  matches: MatchDTO[];
  myPendingEdit: boolean;
  approvalCount: number;
  /** số đơn xin vào đang chờ (chỉ ĐT) */
  pendingJoins: number;
  /** popup tỉ số trận vừa kết thúc + nhắc khai báo (BRD 6.8) */
  postMatch: { resultMatchId: string | null; claimMatchIds: string[] };
  /** khoản người đang xem còn phải đóng theo yêu cầu của ĐT */
  myPayments: Array<{ id: string; kind: 'dues' | 'le'; label: string; amount: number; note: string | null; matchId: string | null; status: 'due' | 'pending' | 'rejected' }>;
  now: string;
  year: number;
}

export interface MyTeam { id: string; name: string; photoUrl: string | null; role: Role }
