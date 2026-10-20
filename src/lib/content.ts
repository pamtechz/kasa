import {z} from 'zod';

const flexString = z.union([
 z.string(),
 z.array(z.string()).transform(arr => arr.join('\n'))
]).transform(val => typeof val === 'string' ? val : String(val ?? ''));

const flexModules = z.union([
 z.array(z.string()),
 z.string().transform(s => s.split('\n').map(x => x.trim()).filter(Boolean))
]).transform(val => Array.isArray(val) ? val : []);

const base=z.object({
 id:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(90),
 title:flexString,
 description:flexString,
 published:z.boolean()
});
const money=z.number().min(0).max(500000).nullable();
export const programmeSchema=base.extend({
 category:z.enum(['main','agri-sport','short-course']),
 duration:flexString,
 durationHours:z.number().int().min(0).max(25000).nullable(),
 requirements:flexString,
 certification:flexString,
 modules:flexModules,
 fee:z.object({
  tuition:money,practical:money,administration:money,foodOptional:money,accommodationOptional:money,packageTotal:money,
  currency:z.literal('ZMW'),note:flexString
 }).passthrough(),
 customFields:z.record(z.unknown()).optional(),
 seedSource:z.string().optional(),
 updatedAt:z.string().optional(),
 updatedBy:z.string().optional(),
 createdAt:z.string().optional()
}).passthrough();
export const announcementSchema=base.extend({
 body:flexString,
 category:z.enum(['admissions','academic','cdf','agents','general']),
 pinned:z.boolean(),
 publishedAt:z.string().datetime({offset:true}).nullable(),
 expiresAt:z.string().datetime({offset:true}).nullable(),
 author:flexString.optional(),
 imageUrl:z.string().url().max(600).optional(),
 tags:z.array(z.string().trim().max(50)).max(10).optional(),
 customFields:z.record(z.unknown()).optional(),
 seedSource:z.string().optional(),
 updatedAt:z.string().optional(),
 updatedBy:z.string().optional(),
 createdAt:z.string().optional()
}).passthrough();
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
