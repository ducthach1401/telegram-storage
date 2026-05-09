import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Folder } from './folder.entity';

@Entity('stored_files')
@Unique(['folderId', 'name'])
export class StoredFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  folderId: string;

  @ManyToOne(() => Folder, (folder) => folder.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'folderId' })
  folder: Folder;

  @Column()
  name: string;

  @Column()
  mimeType: string;

  @Column({ type: 'integer' })
  size: number;

  @Column()
  telegramFileId: string;

  @Column()
  telegramFileUniqueId: string;

  /** file_id của thumbnail trên Telegram (nếu có) */
  @Column({ type: 'varchar', nullable: true })
  thumbnailTelegramFileId: string | null;

  /** message_id để deleteMessage trên chat lưu trữ (upload sau khi thêm cột mới) */
  @Column({ type: 'bigint', nullable: true })
  telegramMessageId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
