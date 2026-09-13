/**
 * What a forum post's audience was told, preserved at the moment staff sent it.
 *
 * A notice is sent once, so the record is what makes a second send refusable
 * and what keeps a later edit of the post from rewriting what the audience
 * actually received. Snapshotting stores the value without interpreting it;
 * the shape below is Commons' own reading of it.
 */
export function noticeRecord({
  content,
  author,
  by,
  at,
}: {
  content: string;
  author: string;
  by: string;
  at: Date;
}): { content: string; author: string; by: string; at: string } {
  return { content, author, by, at: new Date(at).toISOString() };
}
