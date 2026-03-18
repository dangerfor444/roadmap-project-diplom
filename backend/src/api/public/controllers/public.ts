import { issueActorToken } from './handlers/auth';
import { comment, createIdea, unvote, vote } from './handlers/ideas';
import { idea, ideas, roadmap, roadmapItem } from './handlers/read';
import { roadmapComment, roadmapUnvote, roadmapVote } from './handlers/roadmap';

export default {
  issueActorToken,
  roadmap,
  roadmapItem,
  ideas,
  idea,
  createIdea,
  vote,
  unvote,
  comment,
  roadmapVote,
  roadmapUnvote,
  roadmapComment,
};
