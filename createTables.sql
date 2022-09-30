CREATE TABLE tags
(
	tag_name VARCHAR(255) PRIMARY KEY
);

CREATE TABLE users
(
	user_id SERIAL PRIMARY KEY,
	name VARCHAR(255),
	is_faculty BOOLEAN
);

CREATE TABLE build_stage 
(
	stage_name VARCHAR(255) PRIMARY KEY
);

CREATE TABLE recommendation_state
(
	opinion VARCHAR(255),
	PRIMARY KEY (opinion)
);


CREATE TABLE resources
(
	resource_id SERIAL PRIMARY KEY,
	resource_name VARCHAR(255),
	author_name VARCHAR(255),
	url VARCHAR(2048) UNIQUE,
	description VARCHAR(500),
	content_type VARCHAR(255),
	build_stage VARCHAR(255),
	time_date TIMESTAMP DEFAULT NOW(),
	opinion VARCHAR(255),
	opinion_reason VARCHAR(255),
	user_id INTEGER,

	CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(user_id),
	CONSTRAINT fk_build_stage FOREIGN KEY(build_stage) REFERENCES build_stage(stage_name),
	CONSTRAINT fk_recommendation FOREIGN KEY(opinion) REFERENCES recommendation_state(opinion)
);

CREATE TABLE resource_tags 
(
	resource_id INTEGER,
	tag_name VARCHAR(255),
	
	CONSTRAINT fk_resource FOREIGN KEY(resource_id) REFERENCES resources(resource_id),
	CONSTRAINT fk_tag FOREIGN KEY(tag_name) REFERENCES tags(tag_name),
	
	PRIMARY KEY(resource_id, tag_name)
);

CREATE TABLE comments 
(
	comment_id SERIAL PRIMARY KEY,
	resource_id INTEGER,
	comment_body VARCHAR(500),
	user_id INTEGER,

	CONSTRAINT fk_resource FOREIGN KEY(resource_id) REFERENCES resources(resource_id) on delete cascade,
	CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(user_id)
);

CREATE TABLE study_list
(
	user_id INTEGER,
	resource_id INTEGER,

	PRIMARY KEY(user_id, resource_id)
);

CREATE TABLE resource_likes
(
	resource_id INTEGER,
	user_id INTEGER,
	liked BOOLEAN,

	PRIMARY KEY(user_id, resource_id),
	
	CONSTRAINT fk_resource FOREIGN KEY (resource_id) 
		REFERENCES resources(resource_id) ON DELETE CASCADE,
	CONSTRAINT fk_user FOREIGN KEY (user_id) 
		REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE comment_likes
(
	comment_id INTEGER,
	user_id INTEGER,
	liked BOOLEAN,
	PRIMARY KEY(comment_id, user_id),

	CONSTRAINT fk_comment FOREIGN KEY (comment_id) 
		REFERENCES comments(comment_id) ON DELETE CASCADE,
	CONSTRAINT fk_user FOREIGN KEY (user_id)
		REFERENCES users(user_id) ON DELETE CASCADE
); 

insert into recommendation_state values ('Have used and recommend'), ('Have used and do not recommend'), ('Have not used, but looks promising');

insert into build_stage values ('0: Welcome to Academy Build'), ('1: Workflows'), ('2: TypeScript and Code Quality'), ('3: React, HTML and CSS'), 
('4: React and Event Handlers'), ('5: React and useEffect'), ('6: Consolidation: Frontend'), ('7: Node.js and Express'), ('8 - 9: SQL and persistence'),
('10: Pair Full-stack Projects, week 1'), ('11: Team Full-stack Projects, week 2'), ('12: Team Full-stack Projects, week 3'), 
('Technical Interview Prep'), ('20: Passion Projects'), ('21: Building a Personal Portfolio');








