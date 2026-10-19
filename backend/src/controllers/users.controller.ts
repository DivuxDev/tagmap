import { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../config/database';
import { hashPassword } from '../utils/password.utils';
import { AppError } from '../middleware/error.middleware';
import { AuthRequest } from '../types';

export const createUserValidators = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Nombre 2-100 caracteres'),
  body('email').isEmail().normalizeEmail().withMessage('Email válido requerido'),
  body('password').isLength({ min: 6 }).withMessage('Contraseña mínimo 6 caracteres'),
  body('role').optional().isIn(['ADMIN', 'WORKER']).withMessage('Rol debe ser ADMIN o WORKER'),
  body('phone').optional().isMobilePhone('any').withMessage('Teléfono inválido'),
];

// Usuarios virtuales creados por el Folder Watcher (una carpeta del NAS = un usuario)
const INTERNAL_DOMAIN = '@tagmap.internal';

function isInternalEmail(email: string): boolean {
  return email.toLowerCase().endsWith(INTERNAL_DOMAIN);
}

function assertNotInternal(user: { email: string }): void {
  if (isInternalEmail(user.email)) {
    throw new AppError(
      403,
      'Este usuario representa una carpeta del NAS y se gestiona automáticamente. No se puede modificar desde aquí.'
    );
  }
}

// Evita crear/renombrar usuarios de acceso con el nombre de una carpeta del NAS
async function assertNameNotFolder(name: string, excludeId?: string): Promise<void> {
  const clash = await prisma.user.findFirst({
    where: {
      email: { endsWith: INTERNAL_DOMAIN },
      name: { equals: name.trim(), mode: 'insensitive' },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (clash) {
    throw new AppError(
      409,
      `Ya existe una carpeta del NAS llamada "${name.trim()}". Usa un nombre distinto para el usuario de acceso.`
    );
  }
}

export async function listUsers(_req: AuthRequest, res: Response): Promise<void> {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      active: true,
      createdAt: true,
      _count: { select: { photos: true } },
    },
    orderBy: { name: 'asc' },
  });

  res.json({ success: true, data: users });
}

export async function createUser(req: AuthRequest, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: errors.array()[0].msg });
    return;
  }

  const { name, email, password, role, phone } = req.body as {
    name: string;
    email: string;
    password: string;
    role?: 'ADMIN' | 'WORKER';
    phone?: string;
  };

  if (isInternalEmail(email)) {
    throw new AppError(400, `El dominio ${INTERNAL_DOMAIN} está reservado para las carpetas del NAS`);
  }
  await assertNameNotFolder(name);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, 'El email ya está en uso');
  }

  const hashedPassword = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword, role: role || 'WORKER', phone },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      active: true,
      createdAt: true,
    },
  });

  res.status(201).json({ success: true, data: user });
}

export async function updateUser(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { name, email, role, phone, active } = req.body as {
    name?: string;
    email?: string;
    role?: 'ADMIN' | 'WORKER';
    phone?: string;
    active?: boolean;
  };

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new AppError(404, 'Usuario no encontrado');
  }
  assertNotInternal(user);

  if (email && isInternalEmail(email)) {
    throw new AppError(400, `El dominio ${INTERNAL_DOMAIN} está reservado para las carpetas del NAS`);
  }
  if (name) {
    await assertNameNotFolder(name, id);
  }

  // Verificar que el nuevo email no esté en uso por otro usuario
  if (email && email !== user.email) {
    const emailInUse = await prisma.user.findUnique({ where: { email } });
    if (emailInUse) {
      throw new AppError(409, 'El email ya está en uso');
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { name, email, role, phone, active },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      active: true,
      updatedAt: true,
    },
  });

  res.json({ success: true, data: updated });
}

export async function deleteUser(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;

  // No puede eliminarse a sí mismo
  if (req.user?.userId === id) {
    throw new AppError(400, 'No puedes eliminar tu propia cuenta');
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new AppError(404, 'Usuario no encontrado');
  }
  assertNotInternal(user);

  // Soft delete: desactivar en lugar de borrar para mantener historial
  await prisma.user.update({ where: { id }, data: { active: false } });

  res.json({ success: true, message: 'Usuario desactivado correctamente' });
}

export async function changePassword(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { newPassword } = req.body as { newPassword: string };

  if (!newPassword || newPassword.length < 6) {
    throw new AppError(400, 'La nueva contraseña debe tener al menos 6 caracteres');
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new AppError(404, 'Usuario no encontrado');
  }
  assertNotInternal(user);

  const hashedPassword = await hashPassword(newPassword);
  await prisma.user.update({ where: { id }, data: { password: hashedPassword } });

  res.json({ success: true, message: 'Contraseña actualizada' });
}
