'use client';
import {useState,forwardRef} from 'react';
import {Eye,EyeOff} from 'lucide-react';

export interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement>{
  label?:string;
  error?:string;
  hint?:string;
  wrapperClassName?:string;
}

export const PasswordInput = forwardRef<HTMLInputElement,PasswordInputProps>(function PasswordInput(
  {label,error,hint,wrapperClassName='',id,name,required,disabled,...props},
  ref
){
  const [visible,setVisible]=useState(false);
  const inputId = id || (name ? `pwd-${name}` : undefined);

  return (
    <div className={`field ${wrapperClassName}`}>
      {label && (
        <label htmlFor={inputId}>
          {label} {required && <span className="required">*</span>}
        </label>
      )}
      {hint && <p className="field-hint">{hint}</p>}
      <div className="password-input-wrap">
        <input
          {...props}
          ref={ref}
          id={inputId}
          name={name}
          required={required}
          disabled={disabled}
          type={visible ? 'text' : 'password'}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          className="password-toggle-btn"
          onClick={()=>setVisible(v=>!v)}
          aria-label={visible ? 'Hide password' : 'View password'}
          title={visible ? 'Hide password' : 'View password'}
        >
          {visible ? <EyeOff size={18} aria-hidden="true"/> : <Eye size={18} aria-hidden="true"/>}
        </button>
      </div>
      {error && <span className="error-text" role="alert">{error}</span>}
    </div>
  );
});
