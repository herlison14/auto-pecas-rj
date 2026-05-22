'use server';

import { z } from 'zod';
import { AuthError } from 'next-auth';
import { signIn } from '@/lib/auth';

const LoginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

export async function loginAction(_: unknown, formData: FormData) {
  const parsed = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
  }

  const next = (formData.get('next') as string) || '/dashboard';

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: next,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.type === 'CredentialsSignin') {
        return { error: 'Email ou senha incorretos' };
      }
      return { error: 'Erro ao entrar. Tente novamente.' };
    }
    throw err;
  }

  return { error: null };
}
