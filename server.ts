import { Client } from "pg";
import { config } from "dotenv";
import express from "express";
import cors from "cors";

interface IResource {
  resource_name: string,
  author_name: string,
  url: string,
  description: string,
  content_type: string,
  build_stage: string,
  opinion: string,
  opinion_reason: string,
  user_id: number
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

const app = express();

app.use(express.json()); //add body parser to each following route handler
app.use(cors()) //add CORS support to each following route handler

const client = new Client("localResourceDB");
client.connect();

app.post<{}, {}, IResource>("/resources", async (req, res) => {
  const {resource_name, author_name, url, description, content_type, build_stage, opinion, opinion_reason, user_id} = req.body;    
  try {
    const dbResponse = await client.query(`INSERT INTO resources (resource_name, author_name, url, description, content_type, build_stage, opinion, opinion_reason, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`, [resource_name, author_name, url, description, content_type, build_stage, opinion, opinion_reason, user_id]);
    res.status(201).json(dbResponse.rows);
  } catch (error) {
    console.error(error);
    res.status(400).json({status: error});
  }
});

app.post<{res_id: string}, {}, {comment_body: string, user_id: number}>("/resources/:res_id/comments", async (req, res) => {
  const res_id = parseInt(req.params.res_id);
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
app.post<{res_id: string}, {}, {user_id: number, like_or_dislike: "like" | "dislike"}>("/resources/:res_id/likes", async (req, res) => {
  const res_id = parseInt(req.params.res_id);
  const {user_id, like_or_dislike} = req.body;
  const like_boolean = like_or_dislike === "like" ? true : false;
  try {
    const dbResponse = await client.query(`do 
    $do$
    begin
    if exists (select * from likes where user_id = $1 and resource_id = $2) then update likes set liked = $3 where user_id = $1 and resource_id = $2;
    else insert into likes values ($1, $2, $3);
    end if;
    end 
    $do$`, [user_id, res_id, like_boolean]);
    res.status(200);
  } catch (error) {
    console.error(error);
    res.status(400).json({status: error});
  }
});

app.post<{}, {}, {tag_name: string}>("/tags", async (req, res) => {
  const {tag_name} = req.body;
  try {
    const dbResponse = await client.query(`INSERT INTO tags VALUES ($1) RETURNING *`, [tag_name]);
    res.status(201).json(dbResponse.rows);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

app.post<{user_id: string}, {}, {resource_id: number}>("/users/:user_id/study_list", async (req, res) => {
  const user_id = parseInt(req.params.user_id);
  const {resource_id} = req.body;
  try {
    const dbResponse = await client.query(`INSERT INTO study_list (user_id, resource_id) VALUES ($1, $2) RETURNING *`, [user_id, resource_id]);
    res.status(201).json(dbResponse.rows);
  } catch (error) {
    console.error(error);
    res.status(400).json(error);
  }
});

// GET /resources //get all resources
app.get("/resources", async (req, res) => {
  try {
    const response = await client.query("select * from resources order by time_date desc");
    if (response.rowCount > 0) {
      res.status(200).json(response.rows);
    } else {
      res.status(404).json({message: "Could not find any rows"})
    }
  } catch (error) {
    console.error(error);
    res.status(400).json({message: "Ooops"});
  }
})

// GET /resources/:res-id //get a given resource
app.get<{res_id: number}>("/resources/:res_id", async (req, res) => { //add type later
  const {res_id} = req.params;
  try {
    const response = await client.query("select * from resources where resource_id = $1", [res_id]);
    if (response.rowCount === 1) {
      res.status(200).json(response.rows);
    } else {
      res.status(404).json({message: "Could not find any rows or found too many"})
    }
  } catch (error) {
    console.error(error);
    res.status(400).json({message: "Ooops"});
  }
})

// GET /resources/:res-id/comments //get all comments for a resource
app.get<{res_id: number}>("/resources/:res_id/comments", async (req, res) => {
  const {res_id} = req.params
  try {
    const response = await client.query("select * from comments where resource_id = $1", [res_id]);
    if (response.rowCount > 0) {
      res.status(200).json(response.rows);
    } else {
      res.status(404).json({message: "Could not find any rows"})
    }
  } catch (error) {
    console.error(error);
    res.status(400).json({message: "Ooops"});
  }
})

// GET /tags //get all the tags
app.get("/tags", async (req, res) => {
  try {
    const response = await client.query("select * from tags");
    if (response.rowCount > 0) {
      res.status(200).json(response.rows);
    } else {
      res.status(404).json({message: "Could not find any rows"})
    }
  } catch(error) {
    console.error(error);
    res.status(400).json({message: "Ooops"});
  }
})

// GET /users //get all the users
app.get("/users", async (req, res) => {
  try {
    const response = await client.query("select * from users order by name asc");
    if (response.rowCount > 0) {
      res.status(200).json(response.rows);
    } else {
      res.status(404).json({message: "Could not find any rows"})
    }
  } catch(error) {
    console.error(error);
    res.status(400).json({message: "Ooops"});
  }
})

// GET /users/:user-id/study-list //get user's study list
app.get<{user_id: number}>("/users/:user_id/study-list", async (req, res) => {
  const {user_id} = req.params;
  try {
    const response = await client.query("select * from study_list where user_id = $1", [user_id]);
    if (response.rowCount > 0) {
      res.status(200).json(response.rows);
    } else {
      res.status(404).json({message: "Could not find any rows"})
    }
  } catch (error) {
    console.error(error);
    res.status(400).json({message: "Surprise!"});
  }
})

// DELETE /resources/:res-id //delete a resource
app.delete<{res_id: number}>("/resources/:res_id", async (req, res) => {
  const {res_id} = req.params;
  try {
    const response = await client.query("delete from resources where resource_id = $1 returning *", [res_id]);
    if (response.rowCount === 1) {
      res.status(200).json({status: "success", message: `Deleted resource ${res_id}`})
    } else {
      res.status(400).json({message: "This could be bad!"});
    }
  } catch (error) {
    console.error(error);
    res.status(400).json({message: "Surprise!"});
  }
});

// DELETE /resources/:res-id/comments //delete a single comment
app.delete<{comment_id: number}>("/resources/comments/:comment_id", async (req, res) => {
  const {comment_id} = req.params;
  try {
    const response = await client.query("delete from comments where comment_id = $1 returning *", [comment_id]);
    if (response.rowCount === 1) {
      res.status(200).json({status: "success", message: `Deleted comment ${comment_id}`})
    } else {
      res.status(400).json({message: "Couldn't find comment or deleted all!"});
    }
  } catch (error) {
    console.error(error);
    res.status(400).json({message: "Surprise!"});
  }
}
)

// DELETE /resources/:res-id/likes //delete a like or dislike
app.delete<{res_id: number}>("/resources/:res_id/likes", async (req, res) => {
  const {res_id} = req.params;
  try {
    const response = await client.query("delete from likes where resource_id = $1 returning *", [res_id]);
    if (response.rowCount === 1) {
      res.status(200).json({status: "success", message: `Deleted your like/dislike from ${res_id}`})
    } else {
      res.status(400).json({message: "Couldn't find your like/dislike or deleted all!"});
    }
  } catch (error) {
    console.error(error);
    res.status(400).json({message: "Surprise!"});
  }
}
)

// DELETE /tags //delete a tag from the database
app.delete("/tags", async (req, res) => {
  const {tag_name} = req.body;
  try {
    const response = await client.query("delete from tags where tag_name = $1 returning *", [tag_name]);
    if (response.rowCount === 1) {
      res.status(200).json({status: "success", message: `Deleted the tag ${tag_name}`})
    } else {
      res.status(400).json({message: "Something went wrong"});
    }
  } catch (error) {
    console.error(error);
    res.status(400).json({message: "Surprise!"});
  }
})

// DELETE /users/:user-id/study-list //delete resource from user's study list
app.delete<{user_id: number}>("/users/:user_id/study-list", async (req, res) => {
  const {user_id} = req.params;
  const {resource_id} = req.body;
  try {
    const response = await client.query("delete from study_list where user_id = $1 and resource_id = $2 returning *", 
      [user_id, parseInt(resource_id)]);
    if (response.rowCount === 1) {
      res.status(200).json({status: "success", message: `Deleted resource ${resource_id} from your study-list`})
    } else {
      res.status(400).json({message: "Something went wrong"});
    }
  } catch (error) {
    console.error(error);
    res.status(400).json({message: "Surprise!"});
  }
})


//Start the server on the given port
const port = process.env.PORT;
if (!port) {
  throw 'Missing PORT environment variable.  Set it in .env file.';
}
app.listen(port, () => {
  console.log(`Server is up and running on port ${port}`);
});
