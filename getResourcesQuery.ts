export const getResourcesQuery: string = `select resources.*, users.name as user_name, array_agg(resource_tags.tag_name) as tag_array, 
case when likes.num_likes is not null then likes.num_likes else 0 end as num_likes, 
case when dislikes.num_dislikes is not null then dislikes.num_dislikes else 0 end as num_dislikes, likes.liking_users_array, dislikes.disliking_users_array
from
  resources join users
  on resources.user_id = users.user_id
  left join resource_tags      
  on resources.resource_id = resource_tags.resource_id
  left join (select resource_id, array_agg(user_id) as liking_users_array, count(*)
              as num_likes
             from resource_likes where liked=true group by resource_id) as likes
  on resources.resource_id = likes.resource_id
  left join (select resource_id, array_agg(user_id) as disliking_users_array, 
             count(*) as num_dislikes
             from resource_likes where liked=false group by resource_id) as dislikes
  on resources.resource_id = dislikes.resource_id
  group by resources.resource_id, users.name, likes.num_likes, dislikes.num_dislikes, likes.liking_users_array, dislikes.disliking_users_array 
  order by resources.time_date desc`