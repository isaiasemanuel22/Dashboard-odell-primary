import {
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';
import { CreateTreasuryExpenseDto } from '../common/dto';
import { TreasuryService } from './treasury.service';

@Controller('treasury')
export class TreasuryController {
  constructor(private readonly treasuryService: TreasuryService) {}

  @Get()
  getOverview() {
    return this.treasuryService.getOverview();
  }

  @Post('expenses')
  createExpense(@Body() data: CreateTreasuryExpenseDto) {
    return this.treasuryService.recordExpense(data);
  }
}
