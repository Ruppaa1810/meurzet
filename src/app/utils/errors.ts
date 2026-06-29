const errorMap: Record<string, string> = {
  'invalid login credentials': 'Credenciales inválidas. Revisá email y contraseña.',
  'email not confirmed': 'Email no confirmado. Revisá tu bandeja de entrada.',
  'invalid email': 'El formato del email no es válido.',
  'user already registered': 'Este email ya está registrado.',
  'password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres.',
  'rate limit exceeded': 'Demasiados intentos. Esperá unos minutos y volvé a intentar.',
  'timeout': 'La conexión tardó demasiado. Verificá tu internet.',
  'new password should be different': 'La contraseña nueva debe ser distinta a la anterior.',
  'for security purposes, you can only request this once every 60 seconds':
    'Por seguridad, solo podés solicitar esto una vez cada 60 segundos.',
};

export function traducirError(msj: string): string {
  const key = Object.keys(errorMap).find(k => msj.toLowerCase().includes(k));
  return key ? errorMap[key] : msj;
}
