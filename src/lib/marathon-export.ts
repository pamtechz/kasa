export function csvEscape(value:unknown){
 const text=String(value??'');
 const safe=/^[\s\u0000-\u001f]*[=+\-@＝＋－＠]|^[\t\r\n]/u.test(text)?"'"+text:text;
 return '"'+safe.replace(/"/g,'""')+'"';
}
export function schoolWorkspace(role:string){
 if(role==='finance')return '/dashboard/finance';
 if(['super_admin','admin','reviewer'].includes(role))return '/dashboard';
 return role==='agent'?'/agent-portal':'/student-portal';
}
