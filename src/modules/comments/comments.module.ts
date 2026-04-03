import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { ProjectsModule } from '@modules/projects/projects.module';
import { TasksModule } from '@modules/tasks/tasks.module';

@Module({
  imports: [ProjectsModule, TasksModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}