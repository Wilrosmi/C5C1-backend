import { Client } from "pg";
import { config } from "dotenv";
import express from "express";
import cors from "cors";
import axios from "axios";
import { getResourcesQuery } from "./getResourcesQuery";

interface IResourceSubmit {
  resource_name: string,
  author_name: string,
  url: string,
  description: string,
  content_type: string,
  build_stage: string,
  opinion: string,
  opinion_reason: string,
  user_id: number,
  tag_array: {tag_name: string}[]
}


config(); //Read .env file lines as though they were env vars.

//Call this script with the environment variable LOCAL set if you want to connect to a local db (i.e. without SSL)
//Do not set the environment variable LOCAL if you want to connect to a heroku DB.

//For the ssl property of the DB connection config, use a value of...
// false - when connecting to a local DB
// { rejectUnauthorized: false } - when connecting to a heroku DB
const herokuSSLSetting = { rejectUnauthorized: false }
const sslSetting = process.env.LOCAL ? false : herokuSSLSetting
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: sslSetting,
};
const frontEndURL = process.env.LOCAL ? "http://localhost:3000" : "https://c5c1-frontend.netlify.app"

const app = express();

app.use(express.json()); //add body parser to each following route handler
app.use(cors()) //add CORS support to each following route handler

const client = new Client(dbConfig);
client.connect();

app.post<{}, {}, IResourceSubmit>("/resources", async (req, res) => {
  const {resource_name, author_name, url, description, content_type, build_stage, opinion, opinion_reason, user_id, tag_array} = req.body;    
  try {
    const dbResponse = await client.query(`INSERT INTO resources (resource_name, author_name, url, description, content_type, build_stage, opinion, opinion_reason, user_id) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`, 
      [resource_name, author_name, url, description, content_type, build_stage, opinion, opinion_reason, user_id]);
    const {resource_id} = dbResponse.rows[0];
    const existingTags = await client.query(`SELECT * from tags`);
    const existingTagNames = existingTags.rows.map(tagRow => tagRow.tag_name);
    const newTags = tag_array.map(postedTag => postedTag.tag_name).filter(newTag => !existingTagNames.includes(newTag));
    for (const newTag of newTags) {
      await client.query(`INSERT INTO tags VALUES ($1)`, [newTag]);
    }
    for (const tag of tag_array) {
      await client.query(`INSERT INTO resource_tags VALUES ($1, $2)`, [resource_id, tag.tag_name]);
    }
    await axios.post(process.env.DISCORD_URL,
      {content: `There's a new resource (${dbResponse.rows[0].resource_name}) on ${frontEndURL}!`});
    res.status(201).json(dbResponse.rows);
  } catch (error) {
    console.error(error);
    res.status(400).json({status: error});
  }
});

app.post<{res_id: number}, {}, {comment_body: string, user_id: number}>("/resources/:res_id/comments", async (req, res) => {
  const {res_id} = req.params;
  const {comment_body, user_id} = req.body;
  try {
    const dbResponse = await client.query(`INSERT INTO comments (comment_body, user_id, resource_id) VALUES ($1, $2, $3) RETURNING *`, [comment_body, user_id, res_id]);
    res.status(201).json(dbResponse.rows);
  } catch (error) {
    console.error(error);
    res.status(400).json({status: error});
  }
});

// See if it is possible to return from SQL statement
app.post<{res_id: number}, {}, {user_id: number, like_or_dislike: "like" | "dislike"}>("/resources/:res_id/likes", async (req, res) => {
  const {res_id}= req.params;
  const {user_id, like_or_dislike} = req.body;
  const like_boolean = like_or_dislike === "like" ? true : false;
  try {
    const dbResponse = await client.query(`
    INSERT INTO resource_likes VALUES ($1,$2,$3) 
    ON CONFLICT (resource_id, user_id) 
    DO UPDATE SET liked = $3 RETURNING *; `, [res_id, user_id, like_boolean]);
    res.status(200).json(dbResponse);
  } catch (error) {
    console.error(error);
    res.status(400).json({status: error});
  }
});

app.post<{user_id: number}, {}, {resource_id: number}>("/users/:user_id/study_list", async (req, res) => {
const {user_id} = req.params;
  const {resource_id} = req.body;
  try {
    const dbResponse = await client.query(`INSERT INTO study_list (user_id, resource_id) VALUES ($1, $2) RETURNING *`, [user_id, resource_id]);
    res.status(201).json(dbResponse.rows);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

// POST a like or dislike for a particular comment
app.post<{comment_id: number}, {}, {user_id: number, like_or_dislike: "like" | "dislike"}>("/resources/comments/:comment_id/likes", async (req, res) => {
  const {comment_id}= req.params;
  const {user_id, like_or_dislike} = req.body;
  const like_boolean = like_or_dislike === "like" ? true : false;
  try {
    const dbResponse = await client.query(`
    INSERT INTO comment_likes VALUES ($1,$2,$3) 
    ON CONFLICT (comment_id, user_id) 
    DO UPDATE SET liked = $3 RETURNING *; `, [comment_id, user_id, like_boolean]);
    res.status(200).json(dbResponse);
  } catch (error) {
    console.error(error);
    res.status(400).json({status: error});
  }
});

// GET /resources //get all resources
app.get("/resources", async (req, res) => {
  try {
    const dbResponse = await client.query(getResourcesQuery);
    res.status(200).json(dbResponse.rows);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
})

// GET /resources/:res-id //get a given resource
app.get<{res_id: number}>("/resources/:res_id", async (req, res) => { 
  const {res_id} = req.params;
  try {
    const dbResponse = await client.query("select * from resources where resource_id = $1", [res_id]);
    if (dbResponse.rowCount === 1) {
      res.status(200).json(dbResponse.rows);
    } else {
      res.status(404).json({message: "Could not find any rows or found too many"})
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
})

// GET /resources/:res-id/likes
app.get<{res_id: number}>("/resources/:res_id/likes", async (req, res) => {
  const {res_id} = req.params;
  try {
    const dbResponse = await client.query(`select liked, count(*) from resource_likes where resource_id = $1 group by (liked);`, [res_id]);
    res.status(200).json(dbResponse.rows);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
})

// GET /resources/:res-id/comments //get all comments for a resource
app.get<{res_id: number}>("/resources/:res_id/comments", async (req, res) => {
  const {res_id} = req.params
  try {
    const dbResponse = await client.query(`select comments.*, users.name as user_name from comments join users 
      on comments.user_id = users.user_id where resource_id = $1 order by comments.time_date desc`, [res_id]);
    res.status(200).json(dbResponse.rows);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
})

// GET /resources/comments/:comment_id/likes
app.get<{comment_id: number}>("/resources/comments/:comment_id/likes", async (req, res) => {
  const {comment_id} = req.params;
  try {
    const dbResponse = await client.query(`select liked, count(*) from comment_likes where comment_id = $1 group by (liked);`, [comment_id]);
    res.status(200).json(dbResponse.rows);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
})

// GET /opinions 
app.get("/opinions", async (req, res) => {
  try {
    const dbResponse = await client.query("select * from recommendation_state");
    res.status(200).json(dbResponse.rows);
  } catch(error) {
    console.error(error);
    res.status(400).json(error);
  }
})

// GET /stage_names 
app.get("/stage_names", async (req, res) => {
  try {
    const dbResponse = await client.query("select * from build_stage");
    res.status(200).json(dbResponse.rows);
  } catch(error) {
    console.error(error);
    res.status(400).json(error);
  }
})

// GET /tags //get all the tags
app.get("/tags", async (req, res) => {
  try {
    const dbResponse = await client.query("select * from tags");
    res.status(200).json(dbResponse.rows);
  } catch(error) {
    console.error(error);
    res.status(400).json(error);
  }
})

// GET /users //get all the users
app.get("/users", async (req, res) => {
  try {
    const dbResponse = await client.query("select * from users order by name asc");
    res.status(200).json(dbResponse.rows);
  } catch(error) {
    console.error(error);
    res.status(400).json(error);
  }
});

// GET /users/:user-id/study-list //get user's study list
app.get<{user_id: number}>("/users/:user_id/study-list", async (req, res) => {
  const {user_id} = req.params;
  try {
    const dbResponse = await client.query("select * from study_list join resources on study_list.resource_id = resources.resource_id where study_list.user_id = $1", [user_id]);
    res.status(200).json(dbResponse.rows);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
})

// DELETE /resources/:res-id //delete a resource
app.delete<{res_id: number}>("/resources/:res_id", async (req, res) => {
  const {res_id} = req.params;
  try {
    const dbResponse = await client.query("delete from resources where resource_id = $1 returning *", [res_id]);
    if (dbResponse.rowCount === 1) {
      res.status(200).json({status: "success", message: `Deleted resource ${res_id}`})
    } else {
      res.status(400).json({message: "Did not delete exactly one resource"});
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

// DELETE /resources/:res-id/comments //delete a single comment
app.delete<{comment_id: number}>("/resources/comments/:comment_id", async (req, res) => {
  const {comment_id} = req.params;
  try {
    const dbResponse = await client.query("delete from comments where comment_id = $1 returning *", [comment_id]);
    if (dbResponse.rowCount === 1) {
      res.status(200).json({status: "success", message: `Deleted comment ${comment_id}`})
    } else {
      res.status(400).json({message: "Did not delete exactly one comment"});
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
}
)

// DELETE /resources/:res-id/likes //delete a like or dislike
app.delete<{res_id: number}, {}, {user_id: number}>("/resources/:res_id/likes", async (req, res) => {
  const {res_id} = req.params;
  const {user_id} = req.body;
  try {
    const dbResponse = await client.query("delete from resource_likes where resource_id = $1 and user_id=$2 returning *", [res_id, user_id]);
    if (dbResponse.rowCount === 1) {
      res.status(200).json({status: "success", message: `Deleted your like/dislike from ${res_id}`})
    } else {
      res.status(400).json({message: "Did not delete exactly one like/dislike"});
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
}
)

// DELETE from comment_likes
app.delete<{comment_id: number}, {}, {user_id: number}>("/resources/comments/:comment_id/likes", async (req, res) => {
  const {comment_id} = req.params;
  const {user_id} = req.body;
  try {
    const dbResponse = await client.query("delete from comment_likes where comment_id = $1 and user_id=$2 returning *", [comment_id, user_id]);
    if (dbResponse.rowCount === 1) {
      res.status(200).json({status: "success", message: `Deleted your like/dislike from ${comment_id}`})
    } else {
      res.status(400).json({message: "Did not delete exactly one like/dislike"});
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
}
)

// DELETE /tags //delete a tag from the database
app.delete<{}, {}, {tag_name: string}>("/tags", async (req, res) => {
  const {tag_name} = req.body;
  try {
    const dbResponse = await client.query("delete from tags where tag_name = $1 returning *", [tag_name]);
    if (dbResponse.rowCount === 1) {
      res.status(200).json({status: "success", message: `Deleted the tag ${tag_name}`});
    } else {
      res.status(400).json({message: "Did not delete exactly one tag"});
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
})

// DELETE /users/:user-id/study-list //delete resource from user's study list
app.delete<{user_id: number}, {}, {resource_id: number}>("/users/:user_id/study-list", async (req, res) => {
  const {user_id} = req.params;
  const {resource_id} = req.body;
  try {
    const dbResponse = await client.query("delete from study_list where user_id = $1 and resource_id = $2 returning *", 
      [user_id, resource_id]);
    if (dbResponse.rowCount === 1) {
      res.status(200).json({status: "success", message: `Deleted resource ${resource_id} from your study-list`})
    } else {
      res.status(400).json({message: "Did not delete exactly one resource from the study list"});
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

app.put<{res_id: number}, {}, IResourceSubmit>("/resources/:res_id", async (req, res) => {
  const {res_id} = req.params
  const {resource_name, author_name, url, description, content_type, build_stage, opinion, opinion_reason, user_id, tag_array} = req.body;    
  try {
    const dbResponse = await client.query(`UPDATE resources 
      SET resource_name=$1, author_name=$2, url=$3, description=$4, content_type=$5, build_stage=$6, 
      opinion=$7, opinion_reason=$8, user_id=$9 WHERE resource_id=$10 RETURNING *`, 
      [resource_name, author_name, url, description, content_type, build_stage, opinion, opinion_reason, user_id, res_id]);
    const {resource_id} = dbResponse.rows[0];
    await client.query(`DELETE FROM resource_tags WHERE resource_id = $1`, [resource_id]);
    const existingTags = await client.query(`SELECT * from tags`);
    const existingTagNames = existingTags.rows.map(tagRow => tagRow.tag_name);
    const newTags = tag_array.map(postedTag => postedTag.tag_name).filter(newTag => !existingTagNames.includes(newTag));
    for (const newTag of newTags) {
      await client.query(`INSERT INTO tags VALUES ($1)`, [newTag]);
    }
    for (const tag of tag_array) {
      await client.query(`INSERT INTO resource_tags VALUES ($1, $2)`, [resource_id, tag.tag_name]);
    }
    if (dbResponse.rowCount === 1) {
      res.status(201).json(dbResponse.rows);
    } else {
      res.status(400).json("Did not update exactly one row");
    }
  } catch (error) {
    console.error(error);
    res.status(400).json({status: error});
  }
});

app.put<{comment_id: number}, {}, {comment_body: string}>("/resources/comments/:comment_id", async (req, res) => {
  const {comment_id} = req.params;
  const {comment_body} = req.body;
  try {
    const dbResponse = await client.query(`UPDATE comments SET comment_body=$1 WHERE comment_id=$2 RETURNING *`, [comment_body, comment_id])
    if (dbResponse.rowCount === 1) {
      res.status(200).json(dbResponse.rows);
    } else {
      res.status(400).json("Did not update exactly one comment");
    }
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});


//Start the server on the given port
const port = process.env.PORT;
if (!port) {
  throw 'Missing PORT environment variable.  Set it in .env file.';
}
app.listen(port, () => {
  console.log(`Server is up and running on port ${port}`);
});