import {
  Column,
  Entity,
  ManyToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { StoredFile } from './stored-file.entity';

@Entity('file_tags')
@Unique(['name'])
export class FileTag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @ManyToMany(() => StoredFile, (file) => file.tags)
  files: StoredFile[];
}
