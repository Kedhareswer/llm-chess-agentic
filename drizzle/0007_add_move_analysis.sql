-- Post-game analysis columns
ALTER TABLE "games" ADD COLUMN "analyzed" boolean DEFAULT false NOT NULL;
ALTER TABLE "moves" ADD COLUMN "eval_cp" integer;
ALTER TABLE "moves" ADD COLUMN "cp_loss" integer;
ALTER TABLE "moves" ADD COLUMN "move_accuracy" integer;
