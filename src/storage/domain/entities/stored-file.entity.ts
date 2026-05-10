import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinTable,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { FileTag } from './file-tag.entity';
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

  @Index()
  @Column({ type: 'datetime', nullable: true })
  deletedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  deletedOriginalFolderId: string | null;

  @Column({ type: 'varchar', nullable: true })
  deletedOriginalName: string | null;

  @Column()
  mimeType: string;

  @Column({ type: 'integer' })
  size: number;

  @Column({ type: 'varchar', nullable: true })
  telegramFileId: string | null;

  @Column({ type: 'varchar', nullable: true })
  telegramFileUniqueId: string | null;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  contentSha256: string | null;

  @Column({ type: 'varchar', nullable: true })
  s3Bucket: string | null;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  s3ObjectKey: string | null;

  /** file_id của thumbnail trên Telegram (nếu có) */
  @Column({ type: 'varchar', nullable: true })
  thumbnailTelegramFileId: string | null;

  /** message_id để deleteMessage trên chat lưu trữ (upload sau khi thêm cột mới) */
  @Column({ type: 'bigint', nullable: true })
  telegramMessageId: string | null;

  @ManyToMany(() => FileTag, (tag) => tag.files)
  @JoinTable({
    name: 'stored_file_tags',
    joinColumn: { name: 'fileId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tagId', referencedColumnName: 'id' },
  })
  tags: FileTag[];

  @CreateDateColumn()
  createdAt: Date;
}
