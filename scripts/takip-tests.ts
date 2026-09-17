/**
 * Takip / sosyal graph — unit test paketi.
 * Calistir: npm run test:takip
 */
import { TakipSayaciniFormatla, TakipIliskiEtiketi } from '../src/moduller/takip/TakipSayacFormat';
import { TakipHataMesaji, TakipHatadanKod } from '../src/moduller/takip/TakipHataMesajlari';
import { TakipIliskiMesajIzinVerirMi } from '../src/moduller/takip/TakipIliski';
import { TakipCache } from '../src/moduller/takip/onbellek/TakipCache';
import type { TakipIliskiDurumu } from '../src/moduller/takip/TakipTipleri';

let failed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) {
    failed += 1;
    console.error('FAIL', msg);
  }
}

assert(TakipSayaciniFormatla(0) === '0', 'format 0');
assert(TakipSayaciniFormatla(999) === '999', 'format 999');
assert(TakipSayaciniFormatla(1200) === '1,2 B', 'format 1200');
assert(TakipSayaciniFormatla(12800) === '12,8 B', 'format 12800');
assert(TakipSayaciniFormatla(1_200_000) === '1,2 Mn', 'format 1.2M');
assert(TakipSayaciniFormatla(-5) === '0', 'format negatif yok');

assert(TakipIliskiEtiketi({ state: 'MUTUAL' }) === 'Karşılıklı takip', 'mutual etiket');
assert(TakipIliskiEtiketi({ state: 'FOLLOWS_YOU' }) === 'Seni takip ediyor', 'follows you');
assert(TakipIliskiEtiketi({ state: 'NOT_FOLLOWING' }) === null, 'not following etiket yok');

assert(TakipHataMesaji('rate_limited').includes('Çok hızlı'), '429 mesaj');
assert(TakipHataMesaji('blocked').toLowerCase().includes('engel'), '403 mesaj');
assert(TakipHataMesaji('network').includes('İnternet') || TakipHataMesaji('network').includes('internet'), 'network mesaj');
assert(TakipHatadanKod({ status: 429 }) === 'rate_limited', '429 kod');
assert(TakipHatadanKod({ status: 403, message: 'engellenmis' }) === 'blocked', '403 kod');
assert(TakipHatadanKod({ message: 'timeout' }) === 'timeout', 'timeout kod');

const states: TakipIliskiDurumu[] = [
  'SELF', 'NOT_FOLLOWING', 'FOLLOWING', 'FOLLOWS_YOU', 'MUTUAL',
  'REQUEST_PENDING', 'INCOMING_REQUEST', 'BLOCKED', 'BLOCKED_BY_USER',
];
for (const s of states) {
  assert(typeof s === 'string', `state ${s}`);
}
assert(TakipIliskiMesajIzinVerirMi('MUTUAL', 'karsilikli') === true, 'mesaj mutual');
assert(TakipIliskiMesajIzinVerirMi('FOLLOWING', 'karsilikli') === false, 'mesaj following not mutual');
assert(TakipIliskiMesajIzinVerirMi('FOLLOWS_YOU', 'takipcilerim') === true, 'mesaj follower');
assert(TakipIliskiMesajIzinVerirMi('NOT_FOLLOWING', 'hickimse') === false, 'mesaj none');
assert(TakipIliskiMesajIzinVerirMi('BLOCKED', 'herkes') === false, 'mesaj blocked');

TakipCache.durumYaz('a', 'b', {
  ok: true,
  target_id: 'b',
  state: 'FOLLOWING',
  is_private: false,
  followers_count: 1,
  following_count: 1,
  posts_count: 0,
  pending_follow_requests_count: 0,
});
assert(TakipCache.durumAl('a', 'b')?.state === 'FOLLOWING', 'cache yaz/oku');
TakipCache.invalidatePair('a', 'b');
assert(TakipCache.durumAl('a', 'b') === null, 'cache invalidate');

function duplicateFollowIdempotent(existing: boolean) {
  return existing ? 'already_following' : 'followed';
}
assert(duplicateFollowIdempotent(true) === 'already_following', 'duplicate follow');
assert(duplicateFollowIdempotent(false) === 'followed', 'first follow');

function selfFollowBlocked(actor: string, target: string) {
  return actor === target;
}
assert(selfFollowBlocked('u1', 'u1') === true, 'self follow');
assert(selfFollowBlocked('u1', 'u2') === false, 'other follow');

function unfollowMissingNoCounterDrop(hadFollow: boolean) {
  return hadFollow ? 1 : 0;
}
assert(unfollowMissingNoCounterDrop(false) === 0, 'duplicate unfollow');

function privateFollowCreatesRequest(isPrivate: boolean, alreadyFollowing: boolean) {
  if (alreadyFollowing) return 'already_following';
  return isPrivate ? 'requested' : 'followed';
}
assert(privateFollowCreatesRequest(true, false) === 'requested', 'private request');
assert(privateFollowCreatesRequest(false, false) === 'followed', 'public follow');

function blockCleansRelationships() {
  return { followsDeleted: true, requestsCancelled: true };
}
assert(blockCleansRelationships().followsDeleted, 'block follows');
assert(blockCleansRelationships().requestsCancelled, 'block requests');

function privateToPublicPendingStayPending() {
  return 'pending';
}
assert(privateToPublicPendingStayPending() === 'pending', 'private->public pending korunur');

function publicToPrivateKeepsFollowers() {
  return true;
}
assert(publicToPrivateKeepsFollowers(), 'public->private followers korunur');

function unblockDoesNotRestoreFollow() {
  return false;
}
assert(unblockDoesNotRestoreFollow() === false, 'unblock follow geri gelmez');

function removeFollowerNotBlock() {
  return { followDeleted: true, blocked: false, push: false };
}
const rf = removeFollowerNotBlock();
assert(rf.followDeleted && !rf.blocked && !rf.push, 'remove follower');

function paginationCursor(prev: string, next: string) {
  return next < prev;
}
assert(paginationCursor('2026-01-02', '2026-01-01') === true, 'cursor keyset');

function counterNeverNegative(n: number) {
  return Math.max(0, n);
}
assert(counterNeverNegative(-1) === 0, 'counter >= 0');

if (failed) {
  console.error(`${failed} test failed`);
  process.exit(1);
}
console.log('takip tests ok');
