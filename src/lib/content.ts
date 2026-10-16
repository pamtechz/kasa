import {z} from 'zod';
const base=z.object({
 id:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(90),
 title:z.string().trim().min(3).max(180),
 description:z.string().trim().max(1300),
 published:z.boolean()
});
const money=z.number().min(0).max(500000).nullable();
export const programmeSchema=base.extend({
 category:z.enum(['main','agri-sport','short-course']),
 duration:z.string().trim().max(100),
 durationHours:z.number().int().min(0).max(25000).nullable(),
 requirements:z.string().trim().max(2000),
 certification:z.string().trim().max(700),
 modules:z.array(z.string().trim().min(2).max(160)).max(40),
 fee:z.object({
  tuition:money,practical:money,administration:money,foodOptional:money,accommodationOptional:money,packageTotal:money,
  currency:z.literal('ZMW'),note:z.string().trim().max(400)
 }).strict()
}).strict();
export const announcementSchema=base.extend({
 body:z.string().trim().min(10).max(20000),
 category:z.enum(['admissions','academic','cdf','agents','general']),
 pinned:z.boolean(),
 publishedAt:z.string().datetime({offset:true}).nullable(),
 expiresAt:z.string().datetime({offset:true}).nullable(),
 author:z.string().trim().max(120).optional(),
 imageUrl:z.string().url().max(600).optional(),
 tags:z.array(z.string().trim().max(50)).max(10).optional()
}).strict();
export type Programme=z.infer<typeof programmeSchema>;
export type Announcement=z.infer<typeof announcementSchema>;
export const contentCategories=['programmes','announcements'] as const;
export function contentCollection(category:string){
 if(category==='programmes')return 'programmes' as const;
 if(category==='announcements')return 'announcements' as const;
 return null;
}
export function visibleAnnouncement(a:Announcement,now=Date.now()){
 return a.published &&(!a.publishedAt||Date.parse(a.publishedAt)<=now)&&(!a.expiresAt||Date.parse(a.expiresAt)>now);
}
