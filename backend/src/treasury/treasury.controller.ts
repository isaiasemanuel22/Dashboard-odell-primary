import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  CreateTreasuryExpenseDto,
  UpdateTreasuryExpenseDto,
} from '../common/dto';
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

  @Patch('expenses/:id')
  updateExpense(
    @Param('id') id: string,
    @Body() data: UpdateTreasuryExpenseDto,
  ) {
    return this.treasuryService.updateExpense(id, data);
  }

  @Delete('expenses/:id')
  removeExpense(@Param('id') id: string) {
    this.treasuryService.removeExpense(id);
    return { deleted: true };
  }
}
