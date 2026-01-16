ALTER TABLE production_batches
ADD COLUMN created_at TIMESTAMP DEFAULT now();



ALTER TABLE raw_material_issues
ADD COLUMN machine_id UUID;

ALTER TABLE raw_material_issues
ADD CONSTRAINT fk_rmi_machine
FOREIGN KEY (machine_id) REFERENCES machine_master(id);



ALTER TABLE production_entries
ADD COLUMN rm_issue_id UUID;

ALTER TABLE production_entries
ADD CONSTRAINT fk_prod_rm
FOREIGN KEY (rm_issue_id) REFERENCES raw_material_issues(id);
