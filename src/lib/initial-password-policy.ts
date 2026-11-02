/** Shared KASA School and Marathon admin-initial password rules. */
export const INITIAL_PASSWORD_MIN_LENGTH=6;
export const INITIAL_PASSWORD_MAX_LENGTH=128;
export const INITIAL_PASSWORD_HINT='Use 6–128 characters with uppercase, lowercase, a number and a symbol; avoid spaces and common passwords.';
export function isValidInitialPassword(value:unknown):value is string{
 return typeof value==='string'&&value.length>=INITIAL_PASSWORD_MIN_LENGTH&&
  value.length<=INITIAL_PASSWORD_MAX_LENGTH&&/[A-Z]/.test(value)&&
  /[a-z]/.test(value)&&/[0-9]/.test(value)&&/[^A-Za-z0-9]/.test(value)&&
  !/\s/.test(value)&&
  !['password','123456','qwerty','kasa','welcome'].some(part=>value.toLowerCase().includes(part));
}
