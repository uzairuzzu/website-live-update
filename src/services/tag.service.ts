import { prisma } from "@/lib/prisma"

export async function getTags(userId: string) {
  return prisma.tag.findMany({ where: { userId }, orderBy: { name: "asc" } })
}

export async function createTag(userId: string, name: string, color: string) {
  return prisma.tag.create({ data: { userId, name, color } })
}

export async function updateTag(id: string, data: { name?: string; color?: string }) {
  return prisma.tag.update({ where: { id }, data })
}

export async function deleteTag(id: string) {
  return prisma.tag.delete({ where: { id } })
}

export async function setWebsiteTags(websiteId: string, tagIds: string[]) {
  await prisma.websiteTag.deleteMany({ where: { websiteId } })
  if (tagIds.length === 0) return
  await prisma.websiteTag.createMany({
    data: tagIds.map(tagId => ({ websiteId, tagId })),
  })
}

export async function getWebsiteTags(websiteId: string) {
  const wts = await prisma.websiteTag.findMany({
    where: { websiteId },
    include: { tag: true },
  })
  return wts.map(wt => wt.tag)
}
