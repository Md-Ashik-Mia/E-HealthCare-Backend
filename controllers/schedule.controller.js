const DoctorSchedule = require("../models/DoctorSchedule");

exports.createSchedule = async (req, res) => {
  const schedule = await DoctorSchedule.create({
    userId: req.user.sub,
    ...req.body,
  });
  res.json(schedule);
};

exports.getSchedules = async (req, res) => {
  console.log(req.user)
  const list = await DoctorSchedule.find({ userId: req.user.sub });
  res.json(list);
};

exports.deleteSchedule = async (req, res) => {
  await DoctorSchedule.deleteOne({
    _id: req.params.id,
    userId: req.user.sub,
  });
  res.json({ message: "Schedule deleted" });
};
