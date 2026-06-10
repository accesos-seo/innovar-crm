# Setup: Autenticación con Recuperación de Contraseña + Google OAuth

## ✅ Checklist de implementación

### 1. SQL — Crear tablas y RPC

**En Supabase Dashboard → SQL Editor, copiar y ejecutar:**

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.roles (
  id         bigserial PRIMARY KEY,
  name       text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

INSERT INTO public.roles (name) VALUES
  ('admin'), ('super_admin'), ('comercial'), ('diseno'), ('produccion')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text UNIQUE NOT NULL,
  full_name       text,
  phone           text,
  password_hash   text NOT NULL DEFAULT '',
  role_id         bigint REFERENCES public.roles(id),
  bio             text,
  photo_url       text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (email);
CREATE INDEX IF NOT EXISTS users_role_id_idx ON public.users (role_id);

CREATE OR REPLACE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own row" ON public.users
  FOR SELECT TO authenticated USING (id = auth.uid());

CREATE POLICY "Users can update own row" ON public.users
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.update_my_password_hash(new_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.users SET password_hash = new_hash WHERE id = auth.uid();
END;
$$;

COMMIT;
```

### 2. Archivos creados

✅ `src/lib/passwordUtils.ts` — Hashing bcrypt + verificación legacy  
✅ `src/lib/auth.ts` — Lógica de login con email/password + Google OAuth  
✅ `src/pages/ResetPassword.tsx` — Página de reset de contraseña  
✅ `src/pages/AuthCallback.tsx` — Callback de Google OAuth  
✅ `supabase/functions/request-password-reset/index.ts` — Edge Function con Resend  
✅ `db/migrations/052_auth_password_reset_google.sql` — Migraciones SQL  

### 3. Dependencias instaladas

✅ `bcryptjs` — Hashing de contraseñas

### 4. Rutas del router (actualizar `src/App.tsx` o donde esté el router)

```tsx
import ResetPasswordPage from '@/pages/ResetPassword';
import AuthCallback from '@/pages/AuthCallback';

// En el router:
<Route path="/login"          element={<LoginPage />} />
<Route path="/reset-password" element={<ResetPasswordPage />} />
<Route path="/auth/callback"  element={<AuthCallback />} />
```

**Importante:** `/reset-password` y `/auth/callback` deben ser **públicas** (sin RequireAuth).

### 5. Configurar Resend — Secrets en Supabase

En Supabase Dashboard → Edge Functions → request-password-reset → Secrets:

1. Agregar: `RESEND_API_KEY` → Tu API key de Resend
2. Las otras variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) se inyectan automáticamente

**¿Cómo obtener Resend API Key?**
- Ve a https://resend.com
- Sign up o login
- API Keys → Create API Key
- Cópialo y pégalo en Supabase Vault

### 6. Configurar Google OAuth en Supabase

1. **Google Cloud Console** → Crear OAuth Client ID
   - Tipo: Aplicación web
   - Authorized redirect URIs: `https://xdzbjptozeqcbnaqhtye.supabase.co/auth/v1/callback`

2. **Supabase Dashboard** → Authentication → Providers → Google
   - Activar proveedor
   - Client ID y Secret de Google Cloud
   - Guardar

### 7. Deploy de Edge Function

```powershell
cd "D:\Agents-automations\04-Innovar"
supabase functions deploy request-password-reset
```

Si supabase CLI no está instalado:
```powershell
npm install -g supabase
```

### 8. Actualizar Login.tsx (agregar forgot-password inline)

En `src/pages/Login.tsx`, dentro del formulario, agregar:

```tsx
const [isForgotPassword, setIsForgotPassword] = useState(false);
const [forgotEmail, setForgotEmail] = useState('');

// ... en el JSX:
{isForgotPassword ? (
  <div>
    <h2>Recuperar contraseña</h2>
    <input 
      type="email" 
      value={forgotEmail} 
      onChange={(e) => setForgotEmail(e.target.value)}
      placeholder="Tu email"
    />
    <button onClick={async () => {
      try {
        await supabase.functions.invoke('request-password-reset', {
          body: { email: forgotEmail },
        });
        notify.success('Email enviado', 'Revisa tu bandeja de entrada');
        setIsForgotPassword(false);
      } catch (err) {
        notify.error('Error', 'No se pudo enviar el email');
      }
    }}>
      Enviar enlace
    </button>
    <button onClick={() => setIsForgotPassword(false)}>Volver</button>
  </div>
) : (
  <div>
    {/* formulario de login normal */}
    <button onClick={() => setIsForgotPassword(true)} type="button">
      ¿Olvidaste tu contraseña?
    </button>
  </div>
)}
```

### 9. Migraciones de datos (opcional)

Si tienes usuarios en `public.profiles`, migra a `public.users`:

```sql
INSERT INTO public.users (id, email, full_name, password_hash, role_id, created_at)
SELECT 
  p.id, 
  p.email, 
  p.full_name,
  '',  -- sin password hash (requiere reset)
  r.id,  -- rol por defecto
  p.created_at
FROM public.profiles p
LEFT JOIN public.roles r ON r.name = COALESCE(p.role, 'comercial')
ON CONFLICT (id) DO NOTHING;
```

## 🧪 Testing

### Flujo 1: Login con email/password

1. Registra un usuario en `auth.users` vía Supabase Dashboard
2. Inserta un row en `public.users` con el mismo email y un `password_hash` (generado via bcryptjs)
3. Intenta login en la app
4. Si password_hash es legacy plaintext, se migra silenciosamente a bcrypt

### Flujo 2: Recuperación de contraseña

1. Ve a `/login` → "¿Olvidaste tu contraseña?"
2. Ingresa el email
3. Revisa el email (Resend sandbox envía al propietario del proyecto)
4. Haz clic en el enlace → `/reset-password?code=XXX&type=recovery`
5. Ingresa nueva contraseña (min 8 caracteres)
6. Redirige a `/login` automáticamente

### Flujo 3: Google OAuth

1. En `/login`, haz clic en "Login con Google"
2. Autoriza en Google
3. Redirige a `/auth/callback`
4. Se crea automáticamente un row en `public.users` con `password_hash: ''`
5. Redirige a `/` (home)

### Flujo 4: Google → Reset de contraseña

1. Usuario que se registró con Google ahora quiere contraseña
2. Va a `/login` → "¿Olvidaste tu contraseña?"
3. Recibe email con link de reset
4. Completa el reset
5. Ahora puede loguearse con email/password o seguir usando Google

## ⚠️ Variables de entorno

No requieren cambios locales. Las secretas (RESEND_API_KEY) van en Supabase Vault.

## 📧 Email — Dominio verificado

El email remitente es `noreply@cocinasintegralespereira.co` (ya verificado en Resend según CLAUDE.md).

Si necesitas cambiar:
1. En Resend, verifica el nuevo dominio
2. En `supabase/functions/request-password-reset/index.ts`, actualiza `SENDER_EMAIL`
3. Redeploy: `supabase functions deploy request-password-reset`

## 🔒 Seguridad

- ✅ Respuesta genérica cuando email no existe (anti-enumeration)
- ✅ Timing-safe comparison para legacy plaintext
- ✅ Bcrypt con 10 rounds
- ✅ RPC con SECURITY DEFINER
- ✅ Validación de HTTPS en actionLink
- ✅ RLS en tabla users
- ✅ Links de recuperación válidos solo 1 hora

## 🐛 Troubleshooting

**"Usuario no encontrado"** → El email no existe en `public.users`  
**"Credenciales inválidas"** → Password_hash incorrecto o mismatch  
**"No hay sesión activa"** → Recovery link expirado o ya usado  
**Email no llega** → Resend sandbox solo entrega al propietario de la proyecto; agregar dominios verificados en Resend

## Próximos pasos

1. ✅ Ejecutar SQL del paso 1
2. ✅ Instalar dependencias (ya hecho)
3. ⏳ Agregar rutas al router (App.tsx)
4. ⏳ Actualizar Login.tsx con forgot-password inline
5. ⏳ Configurar Google OAuth en Supabase Dashboard
6. ⏳ Deploy Edge Function: `supabase functions deploy request-password-reset`
7. ⏳ Setear `RESEND_API_KEY` en Supabase Vault
8. ⏳ Verificar con testing (ver sección 🧪)
