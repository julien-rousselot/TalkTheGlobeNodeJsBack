import { User } from '../types';
import { Post } from '../types';

export class UserModel {
    private users: User[] = [];

    public createUser(user: User): User {
        this.users.push(user);
        return user;
    }

    public getUserById(id: string): User | undefined {
        return this.users.find(user => user.id === id);
    }

    public getAllUsers(): User[] {
        return this.users;
    }
}

export class PostModel {
    private posts: Post[] = [];

    public createPost(post: Post): Post {
        this.posts.push(post);
        return post;
    }

    public getPostById(id: string): Post | undefined {
        return this.posts.find(post => post.id === id);
    }

    public getAllPosts(): Post[] {
        return this.posts;
    }
}