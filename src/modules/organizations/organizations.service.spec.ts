import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import { OrganizationsService } from './organizations.service';
import { PrismaService } from '@database/prisma.service';
import { ResourceAlreadyExistsException } from '@common/exception/custom.exceptions';
import { expect, jest } from '@jest/globals';
import { describe, beforeEach, it,afterEach  } from '@jest/globals';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let prisma: jest.Mocked<PrismaService>;

  const userId = 'user-uuid-1';
  const orgId = 'org-uuid-1';

  const mockOrg = {
    id: orgId,
    name: 'Acme Corp',
    slug: 'acme-corp',
    description: null,
    logoUrl: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser = {
    id: userId,
    email: 'alice@example.com',
    password: 'hashed',
    firstName: 'Alice',
    lastName: 'Johnson',
    avatarUrl: null,
    isActive: true,
    isEmailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        {
          provide: PrismaService,
          useValue: {
            organization: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
            },
            organizationMember: {
              create: jest.fn(),
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => { jest.clearAllMocks(); });

  // ─── CREATE ──────────────────────────────────────────────────────────────

  describe('create()', () => {
    const createDto = { name: 'Acme Corp', slug: 'acme-corp' };

    it('should create an organization and make creator OWNER', async () => {
      jest.mocked(prisma.organization.findUnique).mockResolvedValue(null);
      (prisma.$transaction as unknown as jest.MockedFunction<(fn: (tx: any) => Promise<any>) => Promise<any>>).mockImplementation(async (fn) => {
        const tx = {
          organization: { create: (jest.fn() as jest.MockedFunction<() => Promise<any>>).mockResolvedValue(mockOrg) },
          organizationMember: { create: jest.fn() },
        };
        return fn(tx);
      });

      const result = await service.create(createDto, userId);

      expect(result.slug).toBe('acme-corp');
      expect(result.myRole).toBe(OrganizationRole.OWNER);
    });

    it('should throw conflict if slug is taken', async () => {
      jest.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrg as any);

      await expect(service.create(createDto, userId)).rejects.toThrow(
        ResourceAlreadyExistsException,
      );
    });
  });

  // ─── INVITE MEMBER ───────────────────────────────────────────────────────

  describe('inviteMember()', () => {
    it('should throw ForbiddenException if ADMIN tries to assign OWNER role', async () => {
      await expect(
        service.inviteMember(
          orgId,
          { email: 'bob@example.com', role: OrganizationRole.OWNER },
          OrganizationRole.ADMIN, // inviter is ADMIN
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw if invitee user does not exist', async () => {
      jest.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(
        service.inviteMember(
          orgId,
          { email: 'ghost@example.com', role: OrganizationRole.MEMBER },
          OrganizationRole.OWNER,
        ),
      ).rejects.toThrow();
    });

    it('should throw if user is already a member', async () => {
      jest.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      jest.mocked(prisma.organizationMember.findUnique).mockResolvedValue({ id: 'existing-membership' } as any);

      await expect(
        service.inviteMember(
          orgId,
          { email: 'alice@example.com', role: OrganizationRole.MEMBER },
          OrganizationRole.OWNER,
        ),
      ).rejects.toThrow(ResourceAlreadyExistsException);
    });
  });

  // ─── REMOVE MEMBER ───────────────────────────────────────────────────────

  describe('removeMember()', () => {
    it('should throw BadRequestException if removing yourself', async () => {
      await expect(
        service.removeMember(orgId, userId, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if removing the last owner', async () => {
      jest.mocked(prisma.organizationMember.findUnique).mockResolvedValue({ role: OrganizationRole.OWNER } as any);
      jest.mocked(prisma.organizationMember.count).mockResolvedValue(1);

      await expect(
        service.removeMember(orgId, 'other-user-id', userId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── UPDATE MEMBER ROLE ──────────────────────────────────────────────────

  describe('updateMemberRole()', () => {
    it('should throw BadRequestException if changing own role', async () => {
      await expect(
        service.updateMemberRole(
          orgId,
          userId,
          { role: OrganizationRole.ADMIN },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

describe('OrganizationsService Placeholder', () => {
  it('should have a placeholder test', () => {
    expect(true).toBe(true);
  });
});