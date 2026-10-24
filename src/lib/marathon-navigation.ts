export const marathonViews=['overview','categories','operations','timeline','recommendations','archive','settings','team','super','activity','sync'] as const;
export type MarathonView=(typeof marathonViews)[number];

export function marathonViewForPath(pathname:string,fallback:string='overview'):MarathonView{
 const match=/^\/(?:marthon|marathon)(?:\/([^/]+))?\/?$/.exec(pathname);
 const requested=match?(match[1]||'overview'):fallback;
 return marathonViews.includes(requested as MarathonView)?requested as MarathonView:'overview';
}

export function isMarathonWorkspacePath(href:string):boolean{
 const pathname=href.split(/[?#]/,1)[0];
 const match=/^\/marthon(?:\/([^/]+))?\/?$/.exec(pathname);
 return !!match&&(!match[1]||marathonViews.includes(match[1] as MarathonView));
}
