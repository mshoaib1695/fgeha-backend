import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feedback } from './entities/feedback.entity';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(Feedback)
    private readonly repo: Repository<Feedback>,
  ) {}

  async create(dto: CreateFeedbackDto, user: User): Promise<Feedback> {
    const feedback = this.repo.create({
      userId: user.id,
      rating: dto.rating,
      feedback: dto.feedback?.trim() || null,
    });
    return this.repo.save(feedback);
  }

  async findAll(): Promise<Feedback[]> {
    return this.repo.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }
}
