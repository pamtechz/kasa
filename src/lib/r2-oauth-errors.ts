// Provider-controlled descriptions and URLs must never enter redirects or logs.
// Only these fixed categories can be sent back to the connection screen.
export function oauthCallbackFailure(params:URLSearchParams):string|null{
 if(params.has('error')){
  switch(params.get('error')){
   case 'access_denied':return 'access-denied';
   case 'invalid_scope':return 'invalid-scope';
   case 'invalid_client':return 'invalid-client';
   case 'unauthorized_client':return 'unauthorized-client';
   case 'invalid_request':return 'invalid-request';
   case 'unsupported_response_type':return 'unsupported-response-type';
   case 'server_error':case 'temporarily_unavailable':return 'provider-unavailable';
   default:return 'provider-error';
  }
 }
 const code=params.get('code')||'';
 return !code||code.length>4096?'invalid-response':null;
}

export function oauthConnectionError(result:string):string{
 const messages:Record<string,string>={
  'access-denied':'Cloudflare did not grant access. Reconnect and approve the required permissions. If no consent screen appears, ask the KASA administrator to check the Cloudflare client’s account access.',
  'invalid-scope':'Cloudflare rejected the requested permissions (invalid_scope). The KASA administrator must match the configured OAuth scopes to the Cloudflare client’s allowed scopes.',
  'invalid-client':'Cloudflare did not recognize KASA’s OAuth client (invalid_client). The KASA administrator must check the configured client ID.',
  'unauthorized-client':'Cloudflare does not permit this OAuth client to use the requested authorization flow (unauthorized_client). The KASA administrator must check the client’s grant types and account access.',
  'invalid-request':'Cloudflare rejected the authorization request (invalid_request). The KASA administrator must check the registered callback URL and OAuth client configuration.',
  'unsupported-response-type':'Cloudflare does not permit the requested response type. The KASA administrator must enable the authorization-code flow for this OAuth client.',
  'provider-unavailable':'Cloudflare authorization is temporarily unavailable. Try connecting again shortly.',
  'provider-error':'Cloudflare rejected the authorization request. The KASA administrator must check the OAuth client configuration.',
  'invalid-response':'Cloudflare returned no usable authorization code. Try connecting again.',
  'invalid-state':'The connection could not be verified. Reconnect from this browser tab and keep it open until Cloudflare returns.',
  expired:'The connection request expired. Try connecting again.',
  inactive:'Your KASA session expired or is inactive. Refresh this page or sign in, then reconnect.',
  unavailable:'Cloudflare authorization is not configured for this website. Contact the KASA administrator.',
  // Older deployments used this result for every provider error, not just cancellation.
  cancelled:'Cloudflare did not complete authorization. Reconnect; if no consent screen appears, contact the KASA administrator.'
 };
 return (Object.hasOwn(messages,result)?messages[result]:'Cloudflare authorization could not be completed. Try connecting again.')+' Your application progress is saved.';
}
