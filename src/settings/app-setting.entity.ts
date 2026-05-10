import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Override cấu hình vận hành (ưu tiên hơn env). Không lưu credential / chuỗi kết nối. */
@Entity('app_settings')
export class AppSetting {
  @PrimaryColumn({ type: 'varchar', length: 190 })
  key!: string;

  @Column({ type: 'text' })
  value!: string;
}
