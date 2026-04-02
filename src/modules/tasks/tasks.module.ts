import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { ProjectsModule } from '@modules/projects/projects.module';

@Module({
  imports: [ProjectsModule], // Import so we can inject ProjectsService
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService], // CommentsModule will need this
})
export class TasksModule {}