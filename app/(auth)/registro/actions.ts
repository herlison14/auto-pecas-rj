'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { signIn } from '@/lib/auth';
import { AuthError } from 'next-auth';

const RegistroSchema = z.object({
  nome: z.string().trim().min(2, 'Nome muito curto'),
  email: z.string().trim().toLowerCase().email('Email inválido'),
  password: z.string().min(8, 'Senha precisa ter pelo menos 8 caracteres'),
});

export async function registroAction(_: unknown, formData: FormData) {
  const parsed = RegistroSchema.safeParse({
    nome: formData.get('nome'),
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
  }

  const { nome, email, password } = parsed.data;
  const db = getDb();

  // Já existe?
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (existing) {
    return { error: 'Email já cadastrado' };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await db.insert(schema.users).values({
    name: nome,
    email,
    hashedPassword,
  });

  // Login automático após cadastro
  try {
    await signIn('credentials', {
      email,
      password,
      redirectTo: '/dashboard',
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: 'Conta criada, mas houve erro no login. Entre manualmente.' };
    }
    throw err;
  }

  return { error: null };
}
