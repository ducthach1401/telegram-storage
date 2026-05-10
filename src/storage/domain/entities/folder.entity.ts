import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { StoredFile } from './stored-file.entity';

@Entity('folders')
@Unique(['parentId', 'name'])
export class Folder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  @Index()
  parentId: string | null;

  @ManyToOne(() => Folder, (f) => f.children, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'parentId' })
  parent: Folder | null;

  @OneToMany(() => Folder, (f) => f.parent)
  children: Folder[];

  @OneToMany(() => StoredFile, (f) => f.folder)
  files: StoredFile[];

  @Column()
  name: string;

  @Index()
  @Column({ type: 'datetime', nullable: true })
  deletedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  deletedOriginalParentId: string | null;

  @Column({ type: 'varchar', nullable: true })
  deletedOriginalName: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
