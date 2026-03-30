import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaNeon } from '@prisma/adapter-neon';



@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private configService: ConfigService) {
     const adapter = new PrismaNeon({
      connectionString: process.env.DATABASE_URL!,
    });
    super({
        adapter,
      
      // Log slow queries in development
      log:
        configService.get<string>('app.nodeEnv') === 'development'
          ? [
              { emit: 'event', level: 'query' },
              { emit: 'stdout', level: 'info' },
              { emit: 'stdout', level: 'warn' },
              { emit: 'stdout', level: 'error' },
            ]
          : [{ emit: 'stdout', level: 'error' }],
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('✅ Database connected successfully');
    } catch (error) {
      this.logger.error('❌ Database connection failed', error);
      throw error; // Fail fast — don't start the app without a DB connection
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  /**
   * Utility: Clean all tables in test environment.
   * NEVER call this in production.
   */
  async cleanDatabase(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('cleanDatabase() cannot be called in production');
    }

    // Delete in correct order to respect foreign key constraints
    await this.$transaction([
      this.comment.deleteMany(),
      this.taskTag.deleteMany(),
      this.taskAssignee.deleteMany(),
      this.task.deleteMany(),
      this.project.deleteMany(),
      this.organizationMember.deleteMany(),
      this.organization.deleteMany(),
      this.refreshToken.deleteMany(),
      this.user.deleteMany(),
      this.tag.deleteMany(),
    ]);
  }
}