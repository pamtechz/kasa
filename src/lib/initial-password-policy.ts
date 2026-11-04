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
export function initialPasswordIssue(password:string,confirmation:string,confirmed:boolean):string{
 if(!password)return 'Enter an initial password. Email verification is not required for this action.';
 if(password.length<INITIAL_PASSWORD_MIN_LENGTH||password.length>INITIAL_PASSWORD_MAX_LENGTH)return 'Use between 6 and 128 characters.';
 if(!/[A-Z]/.test(password))return 'Add an uppercase letter to the initial password.';
 if(!/[a-z]/.test(password))return 'Add a lowercase letter to the initial password.';
 if(!/[0-9]/.test(password))return 'Add a number to the initial password.';
 if(!/[^A-Za-z0-9]/.test(password))return 'Add a symbol to the initial password.';
 if(/\s/.test(password))return 'Remove spaces from the initial password.';
 if(!isValidInitialPassword(password))return 'Choose a password without common terms such as password, kasa, welcome, qwerty or 123456.';
 if(password!==confirmation)return 'Enter the same initial password in both fields.';
 if(!confirmed)return 'Tick the confirmation box to authorize replacing this user’s sign-in password.';
 return '';
}
