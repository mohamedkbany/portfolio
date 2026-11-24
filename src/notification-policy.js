export function notificationTime(n) { return n.createdAt?.toMillis?.() || 0; }
export function visibleNotifications(list, now) {
  const visits=list.filter(n=>n.type === "visit");
  const engaged=new Set(list.filter(n=>n.type !== "visit").map(n=>n.visitorId));
  const bots=new Set();
  visits.forEach(n=>{
    const near=visits.filter(v=>Math.abs(notificationTime(v)-notificationTime(n))<=15000);
    if(new Set(near.map(v=>v.visitorId)).size>=2) near.forEach(v=>{if(!engaged.has(v.visitorId)) bots.add(v.visitorId);});
  });
  return list.filter(n=>!bots.has(n.visitorId) && (n.type!=="visit" || engaged.has(n.visitorId) || now-notificationTime(n)>=15000));
}
export function isVerifiedOwner(u, email) { return !!u && u.emailVerified === true && u.email?.toLowerCase() === email; }
